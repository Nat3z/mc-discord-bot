# Minecraft Discord Bot (Starter)
Hello, world! This is Discord Bot is primarily used for admin purposes,
specifically for managing a Minecraft server.

# Features
- /start - Allows **anyone** on your Discord server to start it.
- /stop - Stops your Minecraft server.
- /world (set/add/remove/list) - Manages world information and lets the admin switch the world.
- /mod (add/remove/list) - Manages mods on the server and lets the admin add/remove mods.

# Planned Features
- Modpack import
- Switch server to different versions
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
4. Create a "mc" directory and put your desired server software, renamed to "server.jar" inside.
5. Still inside the "mc" directory, create a "worlds" directory.
6. Copy the .env.example in the parent directory and rename to .env.
7. Enable Discord Developer Mode [Guide](https://discord.com/developers/docs/game-sdk/store#)
8. Go to the [Developer Portal](https://discord.com/developers) and create a new application.
9. Go to the "Bot" section of your app and create a new bot.
10. Click "Reset Token" and copy paste the token to the .env file.
11. Go to your Discord Server of choice and right click the server on the sidebar. Click "Copy Server ID" and paste into the "GUILD_ID" field.
12. Go to the main channel where the bot will operate and right click the channel. Click "Copy Channel ID" and paste into the "GENERAL_CHANNEL_ID" field in .env
13. Right Click on your name and click "Copy User ID." Paste that into the "ADMIN_ID" field in .env
14. Select a number for how long you want it to take before the server shuts down if no one is online and insert that into the "MINUTES_BEFORE_SHUTDOWN_INACTIVE" field in .env
15. Run start.sh at least once and agree to the server eula.
16. Run this command in the parent directory to start the Discord Bot.
```bash
$ bun run app.ts
```
17. Profit!

**THIS DISCORD BOT IS STILL IN DEVELOPMENT.** MANY FEATURES WILL CHANGE AND INITIAL SETUP WILL SIMPLIFY.
