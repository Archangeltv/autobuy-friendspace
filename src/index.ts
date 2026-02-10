import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import { validateWallet } from "./service/apiService.ts";
import mongoose from "mongoose";
import { MonitoringService } from "./service/monitoringService.ts";
import User from "./models/UserModel.ts";
import { encrypt } from "./helpers/EncryptionHelper.ts";

dotenv.config();


const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("❌ MONGODB_URI is missing");
}


const TG_BOT_TOKEN = process.env.TELEGRAM_TOKEN;

if (!TG_BOT_TOKEN) {
    throw new Error("TELEGRAM_TOKEN is not defined");
}

const bot = new TelegramBot(TG_BOT_TOKEN, {polling: true});

// Connect to DB
mongoose.connect(process.env.MONGODB_URI!).then(async () => {
  console.log("Connected to MongoDB");

  await MonitoringService.init(bot);
});

function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}


interface UserSession {
  stage?: 'awaiting_keys' | 'awaiting_wallet';
  tempWallet?: string;
  tempTwitterUsername?: string;
}

const userSessions = new Map<number, UserSession>();

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    '🤖 Welcome to Auto Key Buyer Bot!\n\n' +
    'Commands:\n' +
    '/add <wallet_address> - Add wallet to monitor\n' +
    '/list - View your monitored wallets\n' +
    '/remove <wallet_address> - Remove a wallet\n' +
    '/balance - Check your key balance'
  );
});

function isValidWalletFormat(wallet: string): boolean {
  const ethRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethRegex.test(wallet) 
}

bot.onText(/\/add(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  try {
    if (!userId) {
      await bot.sendMessage(chatId, "❌ Error identifying user. Please try again.");
      return;
    }

    if (!isDbConnected()) {
      await bot.sendMessage(chatId, "⏳ Bot is still starting up or database is temporarily unavailable. Please try again in a few seconds.");
      return;
    }

    const userProfile = await User.findOne({ chatId: userId });

    if (!userProfile || !userProfile.walletPk) {
      await bot.sendMessage(
        chatId, 
        "⛔ **Access Denied**\n\n" +
        "You have not set up a Private Key yet.\n" +
        "I cannot buy shares without a wallet to sign transactions.\n\n" +
        "👉 Use `/setkey <your_private_key>` to set it up first.",
        { parse_mode: "Markdown" }
      );
      return; 
    }

    const wallet = match?.[1]?.trim();

    if (!wallet) {
      await bot.sendMessage(chatId, '❌ Please provide a wallet address:\n/add <wallet_address>');
      return;
    }

    if (!isValidWalletFormat(wallet)) {
      await bot.sendMessage(chatId, '❌ Invalid wallet address format!');
      return;
    }
    const isValidInAPI = await validateWallet(wallet);
    
    if (isValidInAPI === null) {
      await bot.sendMessage(chatId, '❌ Wallet not found in system or service timed out!');
      return;
    }

    userSessions.set(userId, { 
      stage: 'awaiting_keys', 
      tempWallet: wallet,
      tempTwitterUsername: isValidInAPI.twitterUsername
    });

    await bot.sendMessage(
      chatId,
      `✅ *Wallet validated*\n\n` +
      `💼 Wallet: \`${wallet}\`\n` +
      `🐦 Twitter: [@${isValidInAPI.twitterUsername}](https://x.com/${isValidInAPI.twitterUsername})\n\n` +
      `How many keys do you want to buy when room is created?\n` +
      `_Reply with a number (e.g., 5)_`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error('Error in /add command:', error);
    await bot.sendMessage(chatId, '❌ An error occurred while processing your request. Please try again later.');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;

  try {
    if (!userId || !text || text.startsWith('/')) return;

    if (!isDbConnected()) {
      // For general messages, we might not want to spam if DB is down, 
      // but if they are in a session, we should inform them.
      if (userSessions.has(userId)) {
        await bot.sendMessage(chatId, "⏳ Database connection lost. Please try again in a few seconds.");
      }
      return;
    }

    const session = userSessions.get(userId);

    if (session?.stage === 'awaiting_keys') {
      const keyCount = parseInt(text);

      if (isNaN(keyCount) || keyCount < 1) {
        await bot.sendMessage(chatId, '❌ Please enter a valid number of keys (minimum 1).');
        return;
      }

      await MonitoringService.addWallet(chatId, session.tempWallet!, session.tempTwitterUsername!, keyCount, bot);

      await bot.sendMessage(
        chatId,
        `✅ **Monitoring Active**\n\n` +
        `🐦 User: [@${session.tempTwitterUsername}](https://x.com/${session.tempTwitterUsername})\n` +
        `💼 Wallet: \`${session.tempWallet}\`\n\n` +
        `I am now watching for new rooms from this user.`,
        { parse_mode: "Markdown" }
      );

      userSessions.delete(userId);
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    if (userId && userSessions.has(userId)) {
      await bot.sendMessage(chatId, '❌ An error occurred. Your session might have expired or a service is down.');
    }
  }
});

bot.onText(/\/setkey (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const rawKey = match?.[1]?.trim();

  try {
    if (!userId || !rawKey) {
      if (!userId) {
        await bot.sendMessage(chatId, "❌ Error identifying user.");
      } else {
        await bot.sendMessage(chatId, "❌ Please provide a private key:\n/setkey <your_private_key>");
      }
      return;
    }

    if (!isDbConnected()) {
      await bot.sendMessage(chatId, "⏳ Bot is still starting up or database is temporarily unavailable. Please try again in a few seconds.");
      return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(rawKey) && !/^[a-fA-F0-9]{64}$/.test(rawKey)) {
      await bot.sendMessage(chatId, "❌ Invalid Private Key format. It should be 64 hex characters.");
      return;
    }

    const encryptedKey = encrypt(rawKey);

    await User.findOneAndUpdate(
      { chatId: userId },
      { chatId: userId, walletPk: encryptedKey },
      { upsert: true, new: true }
    );

    await bot.sendMessage(chatId, "✅ **Private Key Saved Securely!**\nI can now perform auto-buys for you.", { parse_mode: 'Markdown' });
    
    bot.deleteMessage(chatId, msg.message_id).catch(() => {}); 
  } catch (error) {
    console.error("Save key error:", error);
    await bot.sendMessage(chatId, "❌ Failed to save key. Please make sure the key is correct and try again.");
  }
});
