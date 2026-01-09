import type TelegramBot from "node-telegram-bot-api";
import fetchNewRooms from "../helpers/roomCreation.ts";
import Script from "../models/ScriptsModel.ts";
import { autoBuyShares } from "../helpers/autobuy.ts";
import User from "../models/UserModel.ts";
import { decrypt } from "../helpers/EncryptionHelper.ts";

// Track monitoring per user+wallet combination
const monitorStatus = new Map<string, boolean>();

export const MonitoringService = {
  async init(bot: TelegramBot) {
    const activeScripts = await Script.find({ isActive: true });
    console.log(`🔄 Re-hydrating ${activeScripts.length} wallet monitors...`);
    
    for (const script of activeScripts) {
      await this.startLoop(script.chatId, script.wallet, script.keysToBuy, bot, false);
    }
  },

  async addWallet(chatId: number, wallet: string, twitterUsername: string, keysToBuy: number, bot: TelegramBot) {
    const key = `${chatId}-${wallet}`;
    if (monitorStatus.get(key)) return; 

    await Script.updateOne(
      { chatId, wallet },
      { $set: { isActive: true, keysToBuy, twitterUsername } },
      { upsert: true }
    );

    await this.startLoop(chatId, wallet, keysToBuy, bot);
  },

  async startLoop(chatId: number, wallet: string, keysToBuy: number, bot: TelegramBot, isNew = true) {
    const key = `${chatId}-${wallet}`;
    monitorStatus.set(key, true);
    if (isNew) console.log(`✅ Started watching: ${wallet} for chatId ${chatId}`);

    const runCheck = async () => {
      if (!monitorStatus.get(key)) return;

      try {
        const roomData = await fetchNewRooms(wallet);

        if (roomData?.room) {
          console.log(`🔥 Room found for ${wallet}! Attempting buys for all watchers...`);

          // Fetch all users watching this wallet
          const usersWatchingWallet = await Script.find({ wallet, isActive: true });

          for (const userScript of usersWatchingWallet) {
            const mainUser = await User.findOne({ chatId: userScript.chatId });
            if (!mainUser) continue; // skip if user not found

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
    const key = `${chatId}-${wallet}`;
    monitorStatus.set(key, false);

    await Script.updateOne(
      { chatId, wallet },
      { $set: { isActive: false } }
    );
    
    console.log(`🛑 Stopped watching: ${wallet} for chatId ${chatId}`);
  }
};
