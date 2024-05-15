const sessionName = "sesi";
const owner = ["6283142933894"];

const {
  default: ChatbotConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidDecode,
  proto,
  getContentType,
  generateForwardMessageContent, 
  prepareWAMessageMedia, 
  generateWAMessageFromContent, 
  generateMessageID, 
  downloadContentFromMessage, 
} = require("@whiskeysockets/baileys");

// const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const axios = require("axios");
const chalk = require("chalk");
const figlet = require("figlet");
const _ = require("lodash");
const PhoneNumber = require("awesome-phonenumber");

// const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
const store = makeInMemoryStore({ })
// can be read from a file
store.readFromFile('./baileys_store.json')
// saves the state to a file every 10s
setInterval(() => {
    store.writeToFile('./baileys_store.json')
}, 10_000)

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

function smsg(conn, m, store) {
  if (!m) return m;
  let M = proto.WebMessageInfo;
  if (m.key) {
    m.id = m.key.id;
    m.isBaileys = m.id.startsWith("BAE5") && m.id.length === 16;
    m.chat = m.key.remoteJid;
    m.fromMe = m.key.fromMe;
    m.isGroup = m.chat.endsWith("@g.us");
    m.sender = conn.decodeJid((m.fromMe && conn.user.id) || m.participant || m.key.participant || m.chat || "");
    if (m.isGroup) m.participant = conn.decodeJid(m.key.participant) || "";
  }
  if (m.message) {
    m.mtype = getContentType(m.message);
    m.msg = m.mtype == "viewOnceMessage" ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype];
    m.body = m.message.conversation || m.msg.caption || m.msg.text || (m.mtype == "listResponseMessage" && m.msg.singleSelectReply.selectedRowId) || (m.mtype == "buttonsResponseMessage" && m.msg.selectedButtonId) || (m.mtype == "viewOnceMessage" && m.msg.caption) || m.text;
    let quoted = (m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null);
    m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
    if (m.quoted) {
      let type = getContentType(quoted);
      m.quoted = m.quoted[type];
      if (["productMessage"].includes(type)) {
        type = getContentType(m.quoted);
        m.quoted = m.quoted[type];
      }
      if (typeof m.quoted === "string")
        m.quoted = {
          text: m.quoted,
        };
      m.quoted.mtype = type;
      m.quoted.id = m.msg.contextInfo.stanzaId;
      m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
      m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith("BAE5") && m.quoted.id.length === 16 : false;
      m.quoted.sender = conn.decodeJid(m.msg.contextInfo.participant);
      m.quoted.fromMe = m.quoted.sender === conn.decodeJid(conn.user.id);
      m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || "";
      m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
      m.getQuotedObj = m.getQuotedMessage = async () => {
        if (!m.quoted.id) return false;
        let q = await store.loadMessage(m.chat, m.quoted.id, conn);
        return exports.smsg(conn, q, store);
      };
      let vM = (m.quoted.fakeObj = M.fromObject({
        key: {
          remoteJid: m.quoted.chat,
          fromMe: m.quoted.fromMe,
          id: m.quoted.id,
        },
        message: quoted,
        ...(m.isGroup ? { participant: m.quoted.sender } : {}),
      }));
      m.quoted.delete = () => conn.sendMessage(m.quoted.chat, { delete: vM.key });
      m.quoted.copyNForward = (jid, forceForward = false, options = {}) => conn.copyNForward(jid, vM, forceForward, options);
      m.quoted.download = () => conn.downloadMediaMessage(m.quoted);
    }
  }
  if (m.msg.url) m.download = () => conn.downloadMediaMessage(m.msg);
  m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || "";
  // m.reply = (text, chatId = m.chat, options = {}) => (Buffer.isBuffer(text) ? conn.sendMedia(chatId, text, "file", "", m, { ...options }) : conn.sendText(chatId, text, m, { ...options }));
  m.reply = (text, chatId = m.chat, options = {}) => {
    conn.sendPresenceUpdate('composing', chatId);
    (Buffer.isBuffer(text) ? 
    conn.sendMedia(chatId, text, "file", "", m, { ...options }) : 
    conn.sendText(chatId, text, m, { ...options }));}
  m.copy = () => exports.smsg(conn, M.fromObject(M.toObject(m)));
  m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => conn.copyNForward(jid, m, forceForward, options);

  return m;
}

async function Bot_Starting() {
  const { state, saveCreds } = await useMultiFileAuthState(`./${sessionName ? sessionName : "session"}`);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  console.log(
    color(
      figlet.textSync("ChatBot Akademik", {
        font: "Standard",
        horizontalLayout: "default",
        vertivalLayout: "default",
        whitespaceBreak: false,
      }),
      "green"
    )
  );

  const client = ChatbotConnect({
    // logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    browser: ["Chatbot-Bimbingan-KRS", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
    patchMessageBeforeSending: (message) => {
      const requiresPatch = !!(
        message.buttonsMessage
        || message.templateMessage
        || message.listMessage
      );
      if (requiresPatch) {
          message = {
              viewOnceMessage: {
                  message: {
                      messageContextInfo: {
                          deviceListMetadataVersion: 2,
                          deviceListMetadata: {},
                      },
                      ...message,
                  },
              },
          };
      }
      return message;
    },
  });

  store.bind(client.ev);

  client.ev.on("messages.upsert", async (chatUpdate) => {
    //console.log(JSON.stringify(chatUpdate, undefined, 2))
    try {
      mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;
      if (mek.key && mek.key.remoteJid === "status@broadcast") return;
      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      if (mek.key.id.startsWith("BAE5") && mek.key.id.length === 16) return;
      m = smsg(client, mek, store);
      require("./botchat")(client, m, chatUpdate, store);
    } catch (err) {
      console.log(err);
    }
  });

  // Handle error
  const unhandledRejections = new Map();
  process.on("unhandledRejection", (reason, promise) => {
    unhandledRejections.set(promise, reason);
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });
  process.on("Something went wrong", function (err) {
    console.log("Caught exception: ", err);
  });

  // Setting
  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    } else return jid;
  };

  client.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = client.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  client.getName = (jid, withoutContact = false) => {
    id = client.decodeJid(jid);
    withoutContact = client.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = client.groupMetadata(id) || {};
        resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
      });
    else
      v =
        id === "0@s.whatsapp.net"
          ? {
              id,
              name: "Pengguna",
            }
          : id === client.decodeJid(client.user.id)
          ? client.user
          : store.contacts[id] || {};
    return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
  };

  client.setStatus = (status) => {
    client.query({
      tag: "iq",
      attrs: {
        to: "@s.whatsapp.net",
        type: "set",
        xmlns: "status",
      },
      content: [
        {
          tag: "status",
          attrs: {},
          content: Buffer.from(status, "utf-8"),
        },
      ],
    });
    return status;
  };

  client.public = true;

  client.serializeM = (m) => smsg(client, m, store);
  
  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(`Bad Session File, Please Delete Session and Scan Again`);
        process.exit();
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Connection closed, reconnecting....");
        Bot_Starting();
      } else if (reason === DisconnectReason.connectionLost) {
        console.log("Connection Lost from Server, reconnecting...");
        Bot_Starting();
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log("Connection Replaced, Another New Session Opened, Please Restart Bot");
        process.exit();
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(`Device Logged Out, Please Delete Folder Session yusril and Scan Again.`);
        process.exit();
      } else if (reason === DisconnectReason.restartRequired) {
        console.log("Restart Required, Restarting...");
        Bot_Starting();
      } else if (reason === DisconnectReason.timedOut) {
        console.log("Connection TimedOut, Reconnecting...");
        Bot_Starting();
      } else {
        console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
        Bot_Starting();
      }
    } else if (connection === "open") {
      console.log(color("Bot success conneted to server", "green"));
      console.log(color("Type /menu to see menu"));
      client.sendMessage(owner + "@s.whatsapp.net", { text: `Bot started!` });
    }
    // console.log('Connected...', update)
  });

  client.ev.on("creds.update", saveCreds);

  //auto kirim pesan pas di call/vc
  client.ws.on('CB:call', async call => {
    if (call.content[0].tag == 'offer') {
        const callerJid = call.content[0].attrs['call-creator']
        const {  platform, notify, t } = call.attrs
        const caption = `Maaf BOT tidak dapat menerima panggilan`
        await client.sendMessage(callerJid, { text: caption })
    }
  })
  //Auto reject pas di call/vc
  client.ev.on('call', async (node) => {
    const { from, id, status } = node[0]
    if (status == 'offer') {
        const stanza = {
            tag: 'call',
            attrs: {
                from: client.user.id,
                to: from,
                id: client.generateMessageTag(),
            },
            content: [
                {
                    tag: 'reject',
                    attrs: {
                        'call-id': id,
                        'call-creator': from,
                        count: '0',
                    },
                    content: undefined,
                },
            ],
        }
        await client.query(stanza)
    }
  })


  const getBuffer = async (url, options) => {
    try {
      options ? options : {};
      const res = await axios({
        method: "get",
        url,
        headers: {
          DNT: 1,
          "Upgrade-Insecure-Request": 1,
        },
        ...options,
        responseType: "arraybuffer",
      });
      return res.data;
    } catch (err) {
      return err;
    }
  };

  client.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    await client.sendPresenceUpdate('composing', jid) 
    let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
    let buffer
    if (options && (options.packname || options.author)) {
        buffer = await writeExifImg(buff, options)
    } else {
        buffer = await imageToWebp(buff)
    }
    await client.sendMessage(jid, {
        sticker: {
            url: buffer 
        }, 
        ...options 
    }, {
        quoted 
    })
    // await client.sendMessage(idgrup, { 
    //     sticker: { 
    //         url: buffer 
    //     }, 
    //     ...options 
    // })
    return buffer
}

/**
 * 
 * @param {*} jid 
 * @param {*} path 
 * @param {*} quoted 
 * @param {*} options 
 * @returns 
 */
client.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
    await client.sendPresenceUpdate('composing', jid) 
    let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
    let buffer
    if (options && (options.packname || options.author)) {
        buffer = await writeExifVid(buff, options)
    } else {
        buffer = await videoToWebp(buff)
    }
    await client.sendMessage(jid, { 
        sticker: { 
            url: buffer 
        }, ...options 
    }, { 
        quoted 
    })
    // await client.sendMessage(idgrup, { 
    //     sticker: { 
    //         url: buffer 
    //     }, ...options 
    // })
    return buffer
}

  client.sendImage = async (jid, path, caption = "", quoted = "", options) => {
    await client.sendPresenceUpdate('composing', jid) 
    let buffer = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
      ? Buffer.from(path.split`,`[1], "base64")
      : /^https?:\/\//.test(path)
      ? await await getBuffer(path)
      : fs.existsSync(path)
      ? fs.readFileSync(path)
      : Buffer.alloc(0);
    return await client.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted });
  };

  client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text: text, ...options }, { quoted });
    /**
     * 
     * @param {*} jid 
     * @param {*} buttons 
     * @param {*} caption 
     * @param {*} footer 
     * @param {*} quoted 
     * @param {*} options 
     */
  client.sendButtonText = (jid, buttons = [], text, footer, quoted = '', options = {}) => {
  let buttonMessage = {
      text,
      footer,
      buttons,
      headerType: 2,
      ...options
  }
  client.sendMessage(jid, buttonMessage, { quoted, ...options })
  }
  client.cMod = (jid, copy, text = "", sender = client.user.id, options = {}) => {
    //let copy = message.toJSON()
    let mtype = Object.keys(copy.message)[0];
    let isEphemeral = mtype === "ephemeralMessage";
    if (isEphemeral) {
      mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
    }
    let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message;
    let content = msg[mtype];
    if (typeof content === "string") msg[mtype] = text || content;
    else if (content.caption) content.caption = text || content.caption;
    else if (content.text) content.text = text || content.text;
    if (typeof content !== "string")
      msg[mtype] = {
        ...content,
        ...options,
      };
    if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
    else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
    if (copy.key.remoteJid.includes("@s.whatsapp.net")) sender = sender || copy.key.remoteJid;
    else if (copy.key.remoteJid.includes("@broadcast")) sender = sender || copy.key.remoteJid;
    copy.key.remoteJid = jid;
    copy.key.fromMe = sender === client.user.id;

    return proto.WebMessageInfo.fromObject(copy);
  };
  client.sendContact = async (jid, name, kon, email, quoted = '', opts = {}) => {
    client.sendPresenceUpdate('composing', jid);
    let list = []
    for (let i of kon) {
      list.push({
        displayName: name,
        vcard: `BEGIN:VCARD\n`+
        `VERSION:3.0\n`+
        `N:${name}\n`+
        `FN:${name}\n`+
        `item1.TEL;waid=${i}:${i}\n`+
        `item1.X-ABLabel:Ponsel\n`+
        `item2.EMAIL;type=INTERNET:${email}\n`+
        `item2.X-ABLabel:Email\n`+
        `item3.URL:https://unima.ac.id\n`+
        `item3.X-ABLabel:Github\n`+
        `item4.ADR:;;Indonesia;;;;\n`+
        `item4.X-ABLabel:Region\n`+
        `END:VCARD`
      })
    }
    client.sendMessage(jid, { contacts: { displayName: name, contacts: list }, ...opts }, { quoted })
  }
  client.sendTextWithMentions = async (jid, text, quoted, options = {}) => client.sendMessage(jid, {
    text: text, 
    contextInfo: { 
        mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') 
    }, ...options 
  }, { quoted })
      
  
client.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
  let quoted = message.msg ? message.msg : message
  let mime = (message.msg || message).mimetype || ''
  let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
  const stream = await downloadContentFromMessage(quoted, messageType)
  let buffer = Buffer.from([])
  for await(const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
  }
  let type = await FileType.fromBuffer(buffer)
  trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
  // save to file
  await fs.writeFileSync(trueFileName, buffer)
  return trueFileName
}

client.downloadMediaMessage = async (message) => {
  let mime = (message.msg || message).mimetype || ''
  let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
  const stream = await downloadContentFromMessage(message, messageType)
  let buffer = Buffer.from([])
  for await(const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
}
  
return buffer
} 

  return client;
}


Bot_Starting();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});