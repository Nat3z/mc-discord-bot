import mc from 'minecraft-protocol'
import { spawn } from 'child_process';
import fs from 'fs';
import { ActivityType, Client, EmbedBuilder, GatewayIntentBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import request from 'request';

const host = 'localhost';
const port = 25565;
const TOKEN = process.env.DISCORD_TOKEN;
const GENERAL_CHANNEL_ID = process.env.GENERAL_CHANNEL_ID;
const ADMIN = process.env.ADMIN_ID;
const GUILD = process.env.GUILD_ID;
const MINUTES_BEFORE_SHUTDOWN_INACTIVE = process.env.MINUTES_BEFORE_SHUTDOWN_INACTIVE;
if (!TOKEN || !GENERAL_CHANNEL_ID || !ADMIN || !GUILD || !MINUTES_BEFORE_SHUTDOWN_INACTIVE) {
  throw new Error("No discord token or client id provided.")
}

import { REST, Routes } from 'discord.js';

const executeCommand = new SlashCommandBuilder()
  .setName('execute')
  .setDescription('Executes a command on the server as console.')
  .addStringOption(option => option.setName('command').setDescription('The command to execute').setRequired(true))

const worldCommand = new SlashCommandBuilder()
  .setName('world')
  .setDescription('Set, add, or remove a world.')
  .addSubcommand(subcommand => subcommand.setName('add').setDescription("Add a world.").addAttachmentOption(option => option.setName('world').setDescription('The world to add').setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('remove').setDescription("Remove a world.").addStringOption(option => option.setName('world').setDescription('The world to remove').setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('list').setDescription('List all worlds.'))
  .addSubcommand(subcommand => subcommand.setName('set').setDescription("Set the world.").addStringOption(option => option.setName('world').setDescription('The world name to set.').setRequired(true)))

const modCommand = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('Add/Remove a mod from the server.')
  .addStringOption(option => option.setName('type').setDescription('The type of action to take').addChoices(
    { name: 'Add', value: 'add' },
    { name: "Remove", value: "remove" },
    { name: 'List', value: 'list' }
  ).setRequired(true))
  .addStringOption(option => option.setName('mod').setDescription('The mod to remove.').setRequired(false))
  .addAttachmentOption(option => option.setName('file').setDescription('The mod to upload.').setRequired(false))

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
  {
    name: 'start',
    description: 'Starts the server.'
  },
  {
    name: 'stop',
    description: 'Stops the server.'
  },
  executeCommand.toJSON(),
  modCommand.toJSON(),
  worldCommand.toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.login(TOKEN);
let generalChannel: TextChannel | undefined;


client.on('ready', async () => {
  console.log(`Logged in as ${client!!.user!!.tag}!`);
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationGuildCommands(client.user!!.id, GUILD), { body: commands });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }

  generalChannel = await client.channels.fetch(GENERAL_CHANNEL_ID) as TextChannel;
  client.user!!.setActivity("Minecraft Server", { type: ActivityType.Watching })
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'start') {
    if (online) {
      await interaction.reply("Server is already online.")
      return
    }
    const embed = new EmbedBuilder()
      .setTitle("Starting Server...")
      .setColor("Green")
      .setDescription("Starting the server... Please wait.")

    await interaction.reply({ embeds: [embed] })
    bootupServer(interaction.user.id);
  }
  else if (interaction.commandName === 'stop') {
    if (!online) {
      await interaction.reply("Server offline already.")
      return
    }

    await interaction.reply("Stopping server...")
    remoteStop(interaction.user.username);
  }
  else if (interaction.commandName === 'execute') {
    if (interaction.user.id !== ADMIN) {
      await interaction.reply("You cannot do this action.")
      return;
    }
    let command = interaction.options.getString('command');
    if (!command) {
      await interaction.reply("No command provided.")
      return;
    }
    if (!online) {
      await interaction.reply("Server is offline.")
      return
    }

    await interaction.reply("Executing command: `$ " + command + "`")
    runCommand(command);
  }
  else if (interaction.commandName === 'mod') {
    if (interaction.user.id !== ADMIN) {
      await interaction.reply("You cannot do this action.")
      return;
    }
    let type = interaction.options.getString('type');
    const file = interaction.options.getAttachment('file');

    if (type === 'add') {
      if (!file) {
        await interaction.reply("No file provided.")
        return;
      }

      await interaction.reply("Adding mod...")
      // download mod and save it to the ./mods/ folder in the "mc" directory
      // run wget to download it
      //
      request.get(file.url).pipe(fs.createWriteStream("./mc/mods/" + file.name)).on('close', async () => {
        await interaction.editReply("Mod added!!!")
      })
    }
    else if (type === 'list') {
      // read files inthe mods folder
      const mods = await fs.promises.readdir("./mc/mods/")
      if (mods.length === 0) {
        await interaction.reply("No mods found.")
        return
      }
      const embed = new EmbedBuilder()
        .setTitle("Mods")
        .setColor("Aqua")
        .setDescription(mods.join("\n"))

      await interaction.reply({ embeds: [embed] })
    }
    else if (type === 'remove') {
      let mod = interaction.options.getString('mod');
      if (!mod) {
        await interaction.reply("No mod provided.")
        return;
      }
      await interaction.reply("Removing mod...")
      // remove mod from the mods folder
      fs.unlink("./mc/mods/" + mod, async (err) => {
        if (err) {
          await interaction.editReply("Failed to remove mod. Reason: " + err.message)
        }
        else {
          await interaction.editReply("Mod removed.")
        }
      })
    }
  }
  else if (interaction.commandName === 'world') {
    if (interaction.user.id !== ADMIN) {
      await interaction.reply("You cannot do this action.")
      return;
    }

    if (online) {
      await interaction.reply("Server is online. Please stop the server before doing this action.")
      return;
    }
    let subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add') {
      let world = interaction.options.getAttachment('world');
      if (!world) {
        await interaction.reply("No world provided.")
        return;
      }
      await interaction.reply("Adding world...")
      fs.mkdir("./mc/worlds/" + world.name, { recursive: true }, (err) => { console.error(err) })

      request.get(world.url).pipe(fs.createWriteStream("./mc/worlds/" + world.name + "/world.zip")).on('close', async () => {
        if (!world) throw new Error("World was somehow undefined..?")
        // unzip the file and remove the zip
        const child = spawn('unzip', ['./mc/worlds/' + world.name + '/world.zip', '-d', './mc/worlds/' + world.name])
        child.on('exit', () => {
          fs.unlink("./mc/worlds/" + world!!.name + "/world.zip", (err) => { if (err) console.error(err) })
        })
        await interaction.editReply("World added!!!")
      })
    }
    else if (subcommand === 'remove') {
      let world = interaction.options.getString('world');
      if (!world) {
        await interaction.reply("No world provided.")
        return;
      }
      await interaction.reply("Removing world...")


      const data = fs.existsSync("./mc/.world") ? await fs.promises.readFile("./mc/.world", "utf8") : undefined;
      if (data === world) {
        await interaction.editReply("Cannot remove the current world.")
        return;
      }
      fs.unlink("./mc/worlds/" + world, async (err) => {
        if (err) {
          await interaction.editReply("Failed to remove world. Reason: " + err.message)
        }
        else {
          await interaction.editReply("World removed.")
        }
      })
    }
    else if (subcommand === 'list') {
      const worlds = await fs.promises.readdir("./mc/worlds/")
      if (worlds.length === 0) {
        await interaction.reply("No worlds found.")
        return
      }
      const embed = new EmbedBuilder()
        .setTitle("Worlds")
        .setColor("Aqua")
        .setDescription(worlds.join("\n"))

      await interaction.reply({ embeds: [embed] })
    }
    else if (subcommand === 'set') {
      let world = interaction.options.getString('world');
      if (!world) {
        await interaction.reply("No world provided.")
        return;
      }

      if (!fs.existsSync("./mc/worlds/" + world)) {
        await interaction.reply("World doesn't exist.")
        return;
      }
      await interaction.reply("Setting world...")
      // save current world to the worlds folder
      // read the "world" file to get the current world
      const data = fs.existsSync("./mc/.world") ? await fs.promises.readFile("./mc/.world", "utf8") : undefined;
      const replaceWorld = () => {
        // copy the new world folder to the world folder on the server
        const child = spawn('rm', ['-rf', './mc/world/'])
        child.on('exit', () => {
          const child = spawn('cp', ['-ruT', './mc/worlds/' + world!! + "/", './mc/world/'])
          child.on('exit', () => {
            interaction.editReply("World Updated!")
          })
        });

      }

      if (data) {

        const child = spawn('cp', ['-ruT', './mc/world/', './mc/worlds/' + data + "/"])
        child.on('exit', () => {
          // write the new world to the file
          fs.writeFile("./mc/.world", world!!, (err) => {
            if (err) {
              console.error(err);
              return;
            }
          })
          replaceWorld();
        })
      }
      else {
        fs.writeFile("./mc/.world", world!!, (err) => {
          if (err) {
            console.error(err)
          }
        })

        replaceWorld();
      }

    }

  }
  else if (interaction.commandName === 'ping') {
    await interaction.reply("Pong!")
  }
});

async function sendShutdownMessage(reason: string = "no reason") {
  if (!generalChannel) throw new Error("Channel not found.");
  const embed = new EmbedBuilder()
    .setTitle("Stopping server...")
    .setColor("Red")
    .setDescription("Server has been shut down. `" + reason + "`")

  generalChannel.send({ embeds: [embed] })
}
let remoteStop = (starter: string) => { };
let runCommand = (command: string) => { };

let online = false;
function bootupServer(starter: string) {
  // execute the ./start.sh script and have access to std in
  const child = spawn('sh', ['./start.sh'], {
    stdio: ['pipe', process.stdout, process.stderr]
  })
  process.stdin.pipe(child.stdin);
  let interval;
  child.on('exit', (code) => {
    clearInterval(interval);
    console.log("Server exited.")
    online = false;
  })

  remoteStop = (starter: string) => {
    child.stdin.write('/stop\r');
    clearInterval(interval);
    sendShutdownMessage("Server stopped by " + starter)
  }

  runCommand = (command) => {
    child.stdin.write(command + '\r');
  }
  function checkIfPlayersAreOnline() {
    interval = setInterval(() => {
      mc.ping({
        host,
        port,
        version: "1.20.1"
      }, (err, res) => {
        res = res as mc.NewPingResult;
        if (err) {
          console.log("Not ready......")
          return;
        }
        if (res.players.online === 0) {
          console.log("No players online. Shutting down server...")
          child.stdin!!.write('/stop\r');
          clearInterval(interval);
          sendShutdownMessage("No players online.")
        }
      })
      // 15 mins
    }, parseInt(MINUTES_BEFORE_SHUTDOWN_INACTIVE!!) * 60 * 1000)
  }
  const interval_isOnline = setInterval(() => {
    mc.ping({
      host: host,
      port: port,
      version: "1.20.1",
    }, (err, res) => {
      res = res as mc.NewPingResult;
      if (err) {
        console.log("Server is not ready yet...")
        return;
      }

      online = true;
      clearInterval(interval_isOnline);
      checkIfPlayersAreOnline();
      console.log("Server detected online! " + host + ":" + port)

      const embed = new EmbedBuilder()
        .setTitle("Server online!")
        .setColor("Green")
        .setDescription("Server is now online by <@" + starter + ">")

      generalChannel!!.send({ embeds: [embed] })
    })
  }, 5000)


}
