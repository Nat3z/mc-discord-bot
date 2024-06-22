import mc from 'minecraft-protocol'
import { spawn } from 'child_process';
import fs from 'fs';
import { ActivityType, CacheType, Client, EmbedBuilder, GatewayIntentBits, Interaction, SlashCommandBuilder, TextChannel, PermissionFlagsBits } from 'discord.js';
import { REST, Routes } from 'discord.js';
import request from 'request';

const host = 'localhost';

type Options = {
  port: number,
  role_allowed: string
}

let Settings: Options = {
  port: 25565,
  role_allowed: ""
};
if (fs.existsSync("./settings.json")) {
  Settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
}

let PORT = Settings.port;
const TOKEN = process.env.DISCORD_TOKEN;
const GENERAL_CHANNEL_ID = process.env.GENERAL_CHANNEL_ID;
const ADMIN = process.env.ADMIN_ID;
const GUILD = process.env.GUILD_ID;
const MINUTES_BEFORE_SHUTDOWN_INACTIVE = process.env.MINUTES_BEFORE_SHUTDOWN_INACTIVE;
if (!TOKEN || !GENERAL_CHANNEL_ID || !ADMIN || !GUILD || !MINUTES_BEFORE_SHUTDOWN_INACTIVE) {
  throw new Error("No discord token or client id provided.")
}
// fetch all server softwares from bukkit.org 
const supportedVersion = await fetch("https://api.papermc.io/v2/projects/paper", {
  "headers": {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "Referer": "https://papermc.io/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": null,
  "method": "GET"
}).then(res => res.json());

type Build = {
  name: string,
  software: string,
  url: string
}

let builds = new Map<string, Build>();
const filteredVersions = ["1.19.4", "1.8.9", "1.12.2", "1.20.6", "1.20.1", "1.21"]
async function updateBuilds() {
  for (const version of supportedVersion.versions) {
    if (!filteredVersions.includes(version)) continue;
    console.log("Fetching Paper Build " + version)
    const data = await fetch(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds`, {
      "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Not/A)Brand\";v=\"8\", \"Chromium\";v=\"126\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "Referer": "https://papermc.io/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "body": null,
      "method": "GET"
    }).then(res => res.json());
    // https://api.papermc.io/v2/projects/paper/versions/1.20.6/builds/147/downloads/paper-1.20.6-147.jar
    const build = data.builds[0];
    builds.set(`paper-${version}`, {
      name: version,
      software: "paper",
      url: `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build.build}/downloads/paper-${version}-${build.build}.jar`
    })

  }
  for (const version of filteredVersions) {
    if (version === "1.8.9" || version === "1.12.2") continue;
    builds.set(`fabric-${version}`, {
      name: version,
      software: "fabric",
      url: `https://meta.fabricmc.net/v2/versions/loader/${version}/0.15.11/1.0.1/server/jar`
    })
  }
  fs.writeFileSync("./builds.json", JSON.stringify(({ "time": Date.now(), ...Object.fromEntries(builds) })))
}
if (!fs.existsSync("./builds.json")) {
  await updateBuilds();
}
else {
  const buildJSONObj = JSON.parse(fs.readFileSync("./builds.json", "utf8"))
  if (Date.now() - buildJSONObj.time > 1000 * 60 * 60 * 24) {
    await updateBuilds();
  } else {
    delete buildJSONObj.time;
    builds = new Map<string, Build>(Object.entries(buildJSONObj))
  }
}

const buildsToSelect = Array.from(builds.keys()).map((key) => {
  return {
    name: key,
    value: key
  };
});


// save builds to a file to prevent ddos
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
  .addSubcommand(subcommand => subcommand.setName('add').setDescription('Add a mod.').addAttachmentOption(option => option.setName('file').setDescription('The mod to upload.').setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('remove').setDescription('Removes a mod.')
    .addStringOption(option => option.setName('mod').setDescription('The mod to remove.').setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('list').setDescription('Lists all mods.'))

const serverCommand = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Select the server software.')
  .addSubcommand(subcommand => subcommand.setName('select').setDescription('Select the name of the server software.').addStringOption(option => option.setName("software").setDescription("The server software name.").setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('list').setDescription('List all server software.'))
  .addSubcommand(subcommand => subcommand.setName('remove').setDescription('Remove the server software.').addStringOption(option => option.setName("software").setDescription("The server software name.").setRequired(true)))
  .addSubcommand(subcommand => subcommand.setName('setup').setDescription('Creates a new server software.').addStringOption(option => option.setName("name").setDescription("The name of your server.").setRequired(true)).addStringOption(option => option.setName('software').setDescription('The server software to select.').addChoices(buildsToSelect).setRequired(true)))

const configCommand = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure the bot and default server settings.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommandGroup(subcommandGroup => subcommandGroup.setName('set-server').setDescription('Select the name of the server software.')
    .addSubcommand(subcommand => subcommand.setName("set-properties")
      .setDescription("Set the defauult server.properties file.")
      .addAttachmentOption(option => option.setName('file').setDescription('The server.properties file to upload.').setRequired(true))
    )
    .addSubcommand(subcommand => subcommand.setName('set-port').setDescription('Set the port of the server.')
      .addIntegerOption(option => option.setName('port').setDescription('The port to set.').setRequired(true))
    )
  )

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
  worldCommand.toJSON(),
  serverCommand.toJSON(),
  configCommand.toJSON()
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

function checkIfServerSelected(interaction: Interaction<CacheType>): Boolean {
  if (!interaction.isChatInputCommand()) return false;
  if (!fs.existsSync("./mc/")) {
    const embed = new EmbedBuilder()
      .setTitle("Server not selected.")
      .setColor("Red")
      .setDescription("Please select a server software first by using /server select <sofware>")

    interaction.reply({ embeds: [embed] })
    return false;
  }
  return true;
}
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'start') {

    if (!checkIfServerSelected(interaction)) return;
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
    if (!checkIfServerSelected(interaction)) return;
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

    await interaction.reply("Executing command: `/" + command + "`")
    runCommand(command);
  }
  else if (interaction.commandName === 'mod') {
    if (!checkIfServerSelected(interaction)) return;
    if (interaction.user.id !== ADMIN) {
      await interaction.reply("You cannot do this action.")
      return;
    }

    let subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add') {
      const file = interaction.options.getAttachment('file');
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
    else if (subcommand === 'list') {
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
    else if (subcommand === 'remove') {
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
    if (!checkIfServerSelected(interaction)) return;
    if (interaction.user.id !== ADMIN) {
      await interaction.reply("You cannot do this action.")
      return;
    }

    if (online) {
      await interaction.reply("Server is online. Please stop the server before doing this action.")
      return;
    }

    if (!fs.existsSync("./mc/worlds/")) fs.mkdirSync("./mc/worlds/");
    if (!fs.existsSync("./mc/.world")) {
      fs.writeFileSync("./mc/.world", "default");
      fs.mkdirSync("./mc/worlds/default");
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

  else if (interaction.commandName === 'server') {
    if (interaction.user.id !== ADMIN) {
      await interaction.reply("You cannot do this action.")
      return;
    }

    let subcommand = interaction.options.getSubcommand();
    if (subcommand === "setup") {
      let software = interaction.options.getString('software');
      let name = interaction.options.getString('name');
      if (!software) {
        await interaction.reply("No software provided.")
        return;
      }

      if (fs.existsSync("./" + name + "-server")) {
        await interaction.reply("Server with that name already exists.")
        return;
      }

      if (fs.existsSync("./mc/")) {
        // deselect by changing name by reading .software file
        if (!fs.existsSync("./mc/.software")) {
          fs.writeFileSync("./mc/.software", "default\ndefault")
        }
        const data = fs.existsSync("./mc/.software") ? fs.readFileSync("./mc/.software", "utf8").split("\n").length > 1 ? fs.readFileSync("./mc/.software", "utf8").split("\n")[1] : "default" : "default";
        fs.renameSync("./mc/", data + "-server");
      }
      if (!fs.existsSync("./mc/")) fs.mkdirSync("./mc/");

      const build = builds.get(software);
      if (!build) {
        await interaction.reply("Invalid software.")
        return;
      }

      await interaction.reply("Downloading server software... Please wait.")
      await new Promise<void>((resolve, _) => request.get(build.url).pipe(fs.createWriteStream("./mc/server.jar")).on('close', async () => {
        await interaction.editReply("Server software downloaded. Running server setup... By using this software, you agree to the Mojang EULA.")
        resolve();
      }))
      await new Promise<void>((resolve, _) => setTimeout(resolve, 2500))
      fs.writeFileSync("./mc/.software", build.name + "\n" + name)
      if (!fs.existsSync("./mc/.world")) fs.writeFileSync("./mc/.world", "default");
      if (!fs.existsSync("./mc/worlds/")) fs.mkdirSync("./mc/worlds/");

      fs.writeFileSync("./mc/eula.txt", "eula=true")
      if (fs.existsSync("./default-server.properties")) {
        fs.copyFileSync("./default-server.properties", "./mc/server.properties")
      }
      interaction.editReply("Server software selected!!")
    }

    else if (subcommand === "select") {
      let software = interaction.options.getString('software');
      // check if folder exists
      if (!fs.existsSync("./" + software + "-server")) {
        interaction.reply("Server software does not exist.")
        return;
      }

      if (fs.existsSync("./mc/")) {
        // deselect by changing name by reading .software file
        //
        if (!fs.existsSync("./mc/.software")) {
          fs.writeFileSync("./mc/.software", "default\ndefaulut");
        }
        const data = fs.existsSync("./mc/.software") ? fs.readFileSync("./mc/.software", "utf8").split("\n").length > 1 ? fs.readFileSync("./mc/.software", "utf8").split("\n")[1] : "default" : "default";
        fs.renameSync("./mc/", data + "-server");
      }
      fs.renameSync("./" + software + "-server", "./mc/");
      await interaction.reply("Server software selected.")
    }
    else if (subcommand === "list") {
      let servers = await fs.promises.readdir("./")
      servers = servers.filter((server) => server.includes("-server"))
      if (fs.existsSync("./mc/")) {
        servers = ["mc", ...servers]
      }

      const mappedSoftwares = new Map<string, string>();
      servers.forEach((server) => {
        const data = fs.existsSync("./" + server + "/.software") ? fs.readFileSync("./" + server + "/.software", "utf8").split("\n").length > 1 ? fs.readFileSync("./" + server + "/.software", "utf8").split("\n") : ["default", "default"] : ["default", "default"];
        mappedSoftwares.set(data[1], data[0]);
      })
      let serversArray = Array.from(mappedSoftwares).map(([server, software]) => "**" + server + "** - " + software)

      if (serversArray.length > 0) {
        serversArray[0] = serversArray[0] + " **(Selected)**"
      }
      serversArray = serversArray.length === 0 ? ["No servers found."] : serversArray;
      const embed = new EmbedBuilder()
        .setTitle("Servers")
        .setColor("Aqua")
        .setDescription(serversArray.join("\n"))
      await interaction.reply({ embeds: [embed] })

    }
    else if (subcommand === "remove") {
      let software = interaction.options.getString('software');
      if (!software) {
        await interaction.reply("No software provided.")
        return;
      }

      if (!fs.existsSync("./" + software + "-server")) {
        await interaction.reply("Server software does not exist or is currently selected. Please switch softwares before removing.")
        return;
      }
      fs.rmdirSync("./" + software + "-server", { recursive: true });
      await interaction.reply("Server software Removed");
    }
  }
  else if (interaction.commandName === "config") {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    if (subcommandGroup === "set-server") {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === "set-properties") {
        const file = interaction.options.getAttachment('file');
        if (!file) {
          await interaction.reply("No file provided.")
          return;
        }

        await interaction.reply("Setting server.properties...")
        request.get(file.url).pipe(fs.createWriteStream("./default-server.properties")).on('close', async () => {
          await interaction.editReply("Updated default server.properties.")
        })
      }
      else if (subcommand === "set-port") {
        const port = interaction.options.getInteger('port');
        if (!port) {
          await interaction.reply("No port provided.")
          return;
        }
        PORT = port;
        Settings.port = port;
        fs.writeFileSync("./settings.json", JSON.stringify(Settings))
        await interaction.editReply("Port set to " + port)
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
        port: PORT,
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
      port: PORT,
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
      console.log("Server detected online! " + host + ":" + PORT)

      const embed = new EmbedBuilder()
        .setTitle("Server online!")
        .setColor("Green")
        .setDescription("Server is now online by <@" + starter + ">")

      generalChannel!!.send({ embeds: [embed] })
    })
  }, 5000)


}
