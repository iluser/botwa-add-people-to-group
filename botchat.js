// const baileys = require("@whiskeysockets/baileys");
// const { 
//   BufferJSON, 
//   WA_DEFAULT_EPHEMERAL, 
//   generateWAMessageFromContent, 
//   proto, 
//   generateWAMessageContent, 
//   generateWAMessage, 
//   prepareWAMessageMedia, 
//   areJidsSameUser, 
//   getContentType 
// } = baileys;

const fs = require("fs");
const util = require("util");
const chalk = require("chalk");
const { error } = require("console");

const q3 = '```'


const createReadFileSync = (path) => {
  if (fs.existsSync(path)) {
      return fs.readFileSync(path)
  }
  else {
      fs.writeFileSync(path, '[]')
      return fs.readFileSync(path)
  }
}

const sleep = async (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = botchat = async (client, m, chatUpdate, store) => {
  try {
    const body = m.mtype === "conversation" ? m.message.conversation : m.mtype === "imageMessage" ? m.message.imageMessage.caption : m.mtype === "videoMessage" ? m.message.videoMessage.caption : m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text : m.mtype === "buttonsResponseMessage" ? m.message.buttonsResponseMessage.selectedButtonId : m.mtype === "listResponseMessage" ? m.message.listResponseMessage.singleSelectReply.selectedRowId : m.mtype === "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId : m.mtype === "messageContextInfo" ? m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text : "";
    const budy = typeof m.text == "string" ? m.text : "";
    const prefix = /^[\/!]/gi.test(body) ? body.match(/^[\/!]/gi) : "/";
    const isCmd2 = body.startsWith(prefix);
    const command = body.replace(prefix, "").trim().split(/ +/).shift().toLowerCase();
    const args = body.trim().split(/ +/).slice(1);
    const pushname = m.pushName || "No Name";
    const botNumber = await client.decodeJid(client.user.id);
    const itsMe = m.sender == botNumber ? true : false;
    let text = (q = args.join(" "));
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    const arg1 = arg.trim().substring(arg.indexOf(" ") + 1);
    const quoted = m.quoted ? m.quoted : m;
    const mime = (quoted.msg || quoted).mimetype || ''

    const from = m.chat;
    const reply = m.reply;
    const sender = m.sender;
    const mek = chatUpdate.messages[0];

    const color = (text, color) => {
      return !color ? chalk.green(text) : chalk.keyword(color)(text);
    };

    function jsonformat (string) {
      return JSON.stringify(string, null, 2)
    }


    // Group
    const groupMetadata = m.isGroup ? await client.groupMetadata(m.chat).catch((e) => {}) : "";
    const groupName = m.isGroup ? groupMetadata.subject : "";

    // Push Message To Console
    let argsLog = budy.length > 30 ? `${q.substring(0, 30)}...` : budy;

    if (isCmd2 && !m.isGroup) {
      console.log(chalk.black(chalk.bgWhite("[ LOGS ]")), color(argsLog, "turquoise"), chalk.magenta("From"), chalk.green(pushname), chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`));
    } else if (isCmd2 && m.isGroup) {
      console.log(
        chalk.black(chalk.bgWhite("[ LOGS ]")),
        color(argsLog, "turquoise"),
        chalk.magenta("From"),
        chalk.green(pushname),
        chalk.yellow(`[ ${m.sender.replace("@s.whatsapp.net", "")} ]`),
        chalk.blueBright("IN"),
        chalk.green(groupName)
      );
    }

    if (budy && !isCmd2 && m.sender === botNumber){
      return;
    }

    if (budy && !isCmd2 && !m.isGroup){
      return reply(`Untuk menggunakan chatbot, silahkan menggunakan perintah ${prefix}menu`)
    }
    
    if (isCmd2) {    
      switch (command) {

        case 'add': {
          let actionType = command === 'kick' ? 'remove' : command === 'add' ? 'add' : command === 'prmt' ? 'promote' : 'demote';
          const contactList = require('./contact3.json'); // Assuming the contact.json is in the same directory
          for (let contact of contactList) {
            let users = contact.number + '@s.whatsapp.net';
            try {
              const su = await client.groupParticipantsUpdate(m.chat, [users], actionType);
              console.log(su);
              if (su[0].status == 403) {
                const code = await client.groupInviteCode(m.chat);
                await client.sendMessage(users, {text: `Silahkan masuk ke grup ini, karena anda tidak bisa di tambahkan. grup ini berisi informasi penting\nhttps://chat.whatsapp.com/${code}`});
                console.log(`Tidak Dapat Menambahkan Pengiriman Undangan`);
                // await client.sendGroupInviteMessage(users);
              } else if (su[0].status == 408) {
                console.log(`Tidak dapat menambahkan karena mereka baru saja keluar dari grup. Coba lagi nanti.`);
                const code = await client.groupInviteCode(m.chat);
                await client.sendMessage(users, {text: `https://chat.whatsapp.com/${code}`});
              } else if (su[0].status == 401) {
                console.log(`Tidak dapat menambahkan karena mereka memblokir nomor Bot, Coba lagi nanti.`);
              } else if (su[0].status == 200) {
                console.log(`Berhasil Menambahkan`);
              } else if (su[0].status == 409) {
                console.log(`Tidak dapat menambahkan karena mereka sudah ada di grup.`);
              } else {
                // await reply(JSON.stringify(su));
                console.log(su)
              }
              await new Promise(resolve => setTimeout(resolve, 5000)); // Delay to prevent spam detection
            } catch (err) {
              console.log(err);
            }
          }
        } break;
        case 'cek':{
          reply(from)
        } break
        case '+': {
          const fs = require('fs');
          const path = require('path');
          const contactPath = path.join(__dirname, 'contact.json');
          fs.readFile(contactPath, 'utf8', (err, data) => {
            if (err) {
              console.error(err);
              return;
            }
            let contacts = JSON.parse(data);
            contacts = contacts.map(contact => {
              contact.number = contact.number.replace(/\+/g, '');
              return contact;
            });
            fs.writeFile(contactPath, JSON.stringify(contacts, null, 2), 'utf8', (err) => {
              if (err) {
                console.error(err);
              } else {
                console.log('All "+" signs have been removed from the numbers in contact.json');
              }
            });
          });
        } break
        
        case 'rapihin': {
          const fs = require('fs');
          const path = require('path');
          const contact2Path = path.join(__dirname, 'contact2.json');
          const outputPath = path.join(__dirname, 'contact3.json');

          fs.readFile(contact2Path, 'utf8', (err, data) => {
            if (err) {
              console.error(err);
              return;
            }
            const numbers = JSON.parse(data);
            const contacts = numbers.map((number, index) => {
              const name = `HF.${190 + index}`; // Generate a name with prefix 'HF.' and a sequential number starting from 190
              return { name, number };
            });

            fs.writeFile(outputPath, JSON.stringify(contacts, null, 2), 'utf8', (err) => {
              if (err) {
                console.error(err);
              } else {
                console.log('contact.json has been updated with formatted contacts');
              }
            });
          });
        } break

        default: {
          if (isCmd2 && budy.toLowerCase() != undefined) {
            if (m.chat.endsWith("broadcast")) return;
            if (m.isBaileys) return;
            if (!budy.toLowerCase()) return;

          } else {
            reply(`Perintah *${prefix}${command}* tidak tersedia, ketik *${prefix}menu* untuk melihat list perintah.`)
          }
        }
      }
    }
  } catch (err) {
    m.reply(util.format(err));
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
