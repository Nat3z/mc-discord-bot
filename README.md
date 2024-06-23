# Minecraft Discord Bot (Starter)
Hello, world! This is Discord Bot is primarily used for admin purposes,
specifically for managing a Minecraft server.

# Features
- /start - Allows **anyone** on your Discord server to start it.
- /stop - Stops your Minecraft server.
- /world (set/add/remove/list) - Manages world information and lets the admin switch the world.
- /server (setup/select/remove) - Manages server information and lets the admin switch the server.
- /mod (add/remove/list) - Manages mods/plugins on the server and lets the admin add/remove mods/plugins.

# Planned Features
- Modpack import
- Better configurations
- Docker Support

# Installation/Setup
1. Clone the repo
```bash
$ git clone https://github.com/Nat3z/mc-discord-bot.git
```
2. Install bun
```bash
$ npm install -g bun
```
3. Install dependencies
```bash
$ bun install
```
4. Copy the .env.example in the parent directory and rename to .env.
1. Enable Discord Developer Mode [Guide](https://discord.com/developers/docs/game-sdk/store#)
1. Go to the [Developer Portal](https://discord.com/developers) and create a new application.
1. Go to the "Bot" section of your app and create a new bot.
1. Click "Reset Token" and copy paste the token to the .env file.
1. Go to your Discord Server of choice and right click the server on the sidebar. Click "Copy Server ID" and paste into the "GUILD_ID" field.
1. Go to the main channel where the bot will operate and right click the channel. Click "Copy Channel ID" and paste into the "GENERAL_CHANNEL_ID" field in .env
1. Right Click on your name and click "Copy User ID." Paste that into the "ADMIN_ID" field in .env
1. Select a number for how long you want it to take before the server shuts down if no one is online and insert that into the "MINUTES_BEFORE_SHUTDOWN_INACTIVE" field in .env
1. Run this command in the parent directory to start the Discord Bot.
```bash
$ bun run app.ts
```
14. Profit!

**THIS DISCORD BOT IS STILL IN DEVELOPMENT.** MANY FEATURES WILL CHANGE AND INITIAL SETUP WILL SIMPLIFY.
