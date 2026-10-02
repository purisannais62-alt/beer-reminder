require("dotenv").config();

const express = require("express");
const { Telegraf } = require("telegraf");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");

// Перевірка налаштувань
const { BOT_TOKEN, BOT_USERNAME } = process.env;
const PORT = Number(process.env.PORT) || 3000;
const TIMEZONE = process.env.TIMEZONE || "Europe/Kyiv";
const REMINDER_HOUR = Number(process.env.REMINDER_HOUR ?? 18);
const REMINDER_MINUTE = Number(process.env.REMINDER_MINUTE ?? 0);

if (!BOT_TOKEN || !BOT_USERNAME) {
  console.error("Заповни BOT_TOKEN і BOT_USERNAME у файлі .env");
  process.exit(1);
}

if (
  !Number.isInteger(REMINDER_HOUR) ||
  REMINDER_HOUR < 0 ||
  REMINDER_HOUR > 23 ||
  !Number.isInteger(REMINDER_MINUTE) ||
  REMINDER_MINUTE < 0 ||
  REMINDER_MINUTE > 59
) {
  console.error("Неправильно вказано час нагадування у .env");
  process.exit(1);
}

const app = express();
const bot = new Telegraf(BOT_TOKEN);
const DATA_FILE = path.join(__dirname, "subscribers.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Зчитування підписників із файлу
function loadSubscribers() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Помилка читання підписників:", error);
    return [];
  }
}

// Збереження підписників
function saveSubscribers(subscribers) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(subscribers, null, 2),
    "utf8"
  );
}

// Додавання підписника
function subscribeUser(user) {
  const subscribers = loadSubscribers();
  const exists = subscribers.some(
    (item) => item.id === user.id
  );

  if (!exists) {
    subscribers.push({
      id: user.id,
      username: user.username || "",
      firstName: user.first_name || "",
      subscribedAt: new Date().toISOString()
    });

    saveSubscribers(subscribers);
    return true;
  }

  return false;
}

// Видалення підписника
function unsubscribeUser(userId) {
  const subscribers = loadSubscribers();
  const filtered = subscribers.filter(
    (item) => item.id !== userId
  );

  saveSubscribers(filtered);
  return filtered.length !== subscribers.length;
}

// Випадкові нейтральні повідомлення
const reminders = [
  "🍺 Нагадування на сьогодні: вечір уже настав. Якщо плануєш відпочити, обирай відповідально — безалкогольний напій теж чудовий варіант.",
  "🌆 Робочий день добігає кінця. Час перепочити, випити води, чаю або іншого напою на свій смак.",
  "🍻 Вечірнє нагадування: відпочинок — це не обов’язково алкоголь. Бережи себе та дотримуйся власних меж.",
  "✨ Настав час зробити паузу. Обирай свій напій відповідально, а якщо сьогодні не хочеться алкоголю — це цілком нормально."
];

// Команда /start
bot.start(async (ctx) => {
  const added = subscribeUser(ctx.from);
  const payload = ctx.startPayload;

  let message =
    "Привіт! 👋\n\n" +
    "Це бот добровільних вечірніх нагадувань.\n\n" +
    "Тут можна підписатися на повідомлення о 18:00 за київським часом.\n" +
    "Алкоголь не є необхідним для відпочинку — безалкогольні варіанти теж підходять.\n\n";

  if (added) {
    message += "✅ Ти підписався на нагадування.\n\n";
  } else {
    message += "ℹ️ Ти вже підписаний на нагадування.\n\n";
  }

  if (payload === "website") {
    message += "Ти перейшов сюди із сайту. Раді бачити!\n\n";
  }

  message +=
    "Команди:\n" +
    "/subscribe — підписатися\n" +
    "/unsubscribe — відписатися\n" +
    "/status — перевірити підписку\n" +
    "/help — допомога";

  await ctx.reply(message);
});

// Команда /subscribe
bot.command("subscribe", async (ctx) => {
  const added = subscribeUser(ctx.from);

  if (added) {
    await ctx.reply(
      "✅ Готово! Ти підписаний на щоденні нагадування о 18:00 за Києвом.\n\n" +
      "Щоб припинити їх отримувати, введи /unsubscribe."
    );
  } else {
    await ctx.reply("ℹ️ Ти вже підписаний на нагадування.");
  }
});

// Команда /unsubscribe
bot.command("unsubscribe", async (ctx) => {
  const removed = unsubscribeUser(ctx.from.id);

  if (removed) {
    await ctx.reply(
      "🔕 Ти відписався від нагадувань. Якщо захочеш повернутися, введи /subscribe."
    );
  } else {
    await ctx.reply("ℹ️ Ти не був підписаний на нагадування.");
  }
});

// Команда /status
bot.command("status", async (ctx) => {
  const subscribers = loadSubscribers();
  const isSubscribed = subscribers.some(
    (item) => item.id === ctx.from.id
  );

  await ctx.reply(
    isSubscribed
      ? "✅ Ти підписаний на щоденні нагадування о 18:00."
      : "🔕 Ти не підписаний. Щоб підписатися, введи /subscribe."
  );
});

// Команда /time
bot.command("time", async (ctx) => {
  await ctx.reply(
    `⏰ Нагадування заплановані на ${String(REMINDER_HOUR).padStart(2, "0")}:${String(REMINDER_MINUTE).padStart(2, "0")} за часовим поясом ${TIMEZONE}.`
  );
});

// Команда /help
bot.help(async (ctx) => {
  await ctx.reply(
    "🤖 Допомога\n\n" +
    "/start — запустити бота\n" +
    "/subscribe — підписатися\n" +
    "/unsubscribe — відписатися\n" +
    "/status — статус підписки\n" +
    "/time — час нагадування\n" +
    "/help — список команд\n\n" +
    "Нагадування надсилаються добровільно підписаним користувачам. " +
    "Якщо ти повнолітній і вирішуєш вживати алкоголь, роби це відповідально. " +
    "Не сідай за кермо після вживання алкоголю."
  );
});

// Надсилання щоденних повідомлень
async function sendDailyReminders() {
  const subscribers = loadSubscribers();
  console.log(`Надсилання нагадувань: ${subscribers.length} підписників`);

  for (const user of subscribers) {
    const message =
      reminders[Math.floor(Math.random() * reminders.length)];

    try {
      await bot.telegram.sendMessage(user.id, message);
    } catch (error) {
      console.error(
        `Не вдалося надіслати повідомлення користувачу ${user.id}:`,
        error.message
      );

      // Якщо користувач заблокував бота, видаляємо його з підписників
      if (
        error.response &&
        [403, 400].includes(error.response.error_code)
      ) {
        unsubscribeUser(user.id);
      }
    }

    // Невелика пауза між повідомленнями
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("Надсилання завершено.");
}

// Розклад: щодня о заданій годині
const cronExpression =
  `${REMINDER_MINUTE} ${REMINDER_HOUR} * * *`;

cron.schedule(
  cronExpression,
  () => {
    sendDailyReminders().catch((error) => {
      console.error("Помилка розсилки:", error);
    });
  },
  {
    timezone: TIMEZONE
  }
);

// Перехід із сайту до Telegram
app.get("/subscribe", (req, res) => {
  const telegramLink =
    `https://t.me/${BOT_USERNAME}?start=website`;

  res.redirect(telegramLink);
});

// Статистика для сайту
app.get("/api/stats", (req, res) => {
  res.json({
    subscribers: loadSubscribers().length,
    reminderTime:
      `${String(REMINDER_HOUR).padStart(2, "0")}:${String(REMINDER_MINUTE).padStart(2, "0")}`,
    timezone: TIMEZONE
  });
});

// Перевірка роботи сервера
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Запуск сервера і бота
async function start() {
  try {
    await bot.launch();
    console.log("Telegram-бот запущений.");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Сайт працює на http://localhost:${PORT}`);
      console.log(
        `Нагадування: щодня о ${REMINDER_HOUR}:${String(REMINDER_MINUTE).padStart(2, "0")} (${TIMEZONE})`
      );
    });
  } catch (error) {
    console.error("Не вдалося запустити бота:", error);
    process.exit(1);
  }
}

start();

// Коректне завершення процесу
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));