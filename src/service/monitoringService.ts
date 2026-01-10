import type TelegramBot from "node-telegram-bot-api";
import fetchNewRooms from "../helpers/roomCreation.ts";
import Script from "../models/ScriptsModel.ts";
import { autoBuyShares } from "../helpers/autobuy.ts";
import User from "../models/UserModel.ts";
import { decrypt } from "../helpers/EncryptionHelper.ts";

const monitorStatus = new Map<string, boolean>();

export const MonitoringService = {
  async init(bot: TelegramBot) {
    const activeScripts = await Script.find({ isActive: true });
    console.log(`🔄 Re-hydrating ${activeScripts.length} wallet monitors...`);
    
    const uniqueWallets = new Set<string>();
    activeScripts.forEach(script => uniqueWallets.add(script.wallet));
    
    for (const wallet of uniqueWallets) {
      await this.startLoop(wallet, bot);
    }
  },

  async addWallet(chatId: number, wallet: string, twitterUsername: string, keysToBuy: number, bot: TelegramBot) {
    await Script.updateOne(
      { chatId, wallet },
      { $set: { isActive: true, keysToBuy, twitterUsername } },
      { upsert: true }
    );

    if (!monitorStatus.get(wallet)) {
      await this.startLoop(wallet, bot);
    }
  },

  async startLoop(wallet: string, bot: TelegramBot) {
    if (monitorStatus.get(wallet)) {
      console.log(`⚠️ Loop already running for ${wallet}`);
      return;
    }

    monitorStatus.set(wallet, true);
    console.log(`✅ Started monitoring wallet: ${wallet}`);

    const runCheck = async () => {
      if (!monitorStatus.get(wallet)) return;

      try {
        const roomData = await fetchNewRooms(wallet);

        if (roomData?.room) {
          console.log(`🔥 Room found for ${wallet}! Attempting buys for all watchers...`);

          const usersWatchingWallet = await Script.find({ wallet, isActive: true });

          for (const userScript of usersWatchingWallet) {
            const mainUser = await User.findOne({ chatId: userScript.chatId });
            if (!mainUser) continue;

            try {
              await bot.sendMessage(
                userScript.chatId,
                `🥜 Attempting buy for [@${userScript.twitterUsername}](https://x.com/${userScript.twitterUsername})...\n💼 Wallet: \`${wallet}\``,
                { parse_mode: 'Markdown' }
              );

              const purchaseResult = await autoBuyShares({
                privateKey: decrypt(mainUser.walletPk),
                tokenId: Number(roomData.room.id),
                amount: userScript.keysToBuy,
                CONTRACT_ADDRESS: roomData.room.contract,
              });

              if (purchaseResult) {
                await bot.sendMessage(
                  userScript.chatId,
                  `🎉 Bought ${userScript.keysToBuy} keys for [@${userScript.twitterUsername}](https://x.com/${userScript.twitterUsername})!\n💼 Wallet: \`${wallet}\`\nTx: [${purchaseResult}](https://basescan.org/tx/${purchaseResult})`,
                  { parse_mode: 'Markdown' }
                );
              }
            } catch (err) {
              console.error(`Error buying for chatId ${userScript.chatId}:`, err);
            }
          }

          monitorStatus.set(wallet, false);
          return;
        }
      } catch (e) {
        console.error(`Error checking ${wallet}:`, e);
      }

      const delay = 500 + Math.random() * 500;
      setTimeout(runCheck, delay);
    };

    runCheck();
  },

  async stopWallet(chatId: number, wallet: string) {
    await Script.updateOne(
      { chatId, wallet },
      { $set: { isActive: false } }
    );

    const stillWatching = await Script.findOne({ wallet, isActive: true });
    
    if (!stillWatching) {
      monitorStatus.set(wallet, false);
      console.log(`🛑 Stopped monitoring wallet: ${wallet} (no more watchers)`);
    } else {
      console.log(`ℹ️ Removed chatId ${chatId} from ${wallet}, but others still watching`);
    }
  }
};
