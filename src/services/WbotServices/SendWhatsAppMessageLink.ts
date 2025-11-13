import { delay, WAMessage } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import fs from "fs";
import path from "path";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { ENABLE_LID_DEBUG } from "../../config/debug";
import { normalizeJid } from "../../utils";
import { isNil } from "lodash";

interface Request {
  whatsappId: number;
  contact: Contact;
  url: string;
  caption: string;
  msdelay?: number;
}

function makeid(length: number) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const SendWhatsAppMessageLink = async ({
  whatsappId,
  contact,
  url,
  caption,
  msdelay
}: Request): Promise<WAMessage> => {
  const wbot = await getWbot(whatsappId);

  // --- 🔧 Tratamento completo para contatos LID ---
  let jid: string;
  const isLidContact = contact.number.includes("@lid");

  if (isLidContact) {
    // Contato LID — garantir formato correto
    jid = contact.number.replace("@lid@s.whatsapp.net", "@lid");

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - Contato LID detectado, usando JID: ${jid}`);
    }
  } else if (contact.remoteJid && !contact.remoteJid.includes("@lid@s.whatsapp.net")) {
    // Usa remoteJid se válido
    jid = contact.remoteJid;

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - Usando remoteJid armazenado: ${jid}`);
    }
  } else {
    // Fallback padrão
    jid = `${contact.number}@${contact.isGroup ? "g.us" : "s.whatsapp.net"}`;

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - Construindo JID manualmente: ${jid}`);
    }
  }

  // Normaliza o JID final
  jid = normalizeJid(jid);

  if (ENABLE_LID_DEBUG) {
    logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - JID final normalizado: ${jid}`);
    logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - Contact number: ${contact.number}`);
    logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - Contact remoteJid: ${contact.remoteJid}`);
    logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - IsGroup: ${contact.isGroup}`);
  }

  const safeCaption = caption.replace(/[\\/:"*?<>|]/g, "-"); // evita caracteres inválidos
  const randomSuffix = makeid(5);
  const filePath = path.join(publicFolder, `company${contact.companyId}`, `${safeCaption}-${randomSuffix}.pdf`);

  try {
    await delay(msdelay);

    const documentContent = url
      ? { url }
      : fs.existsSync(filePath)
      ? fs.readFileSync(filePath)
      : null;

    if (isNil(documentContent)) {
      throw new AppError(`Arquivo não encontrado: ${filePath}`);
    }

    const sentMessage = await wbot.sendMessage(jid, {
      document: documentContent,
      fileName: `${safeCaption}.pdf`,
      mimetype: "application/pdf",
      caption: safeCaption
    });

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendWhatsAppMessageLink - Documento enviado com sucesso para ${jid}`);
    }

    return sentMessage;
  } catch (err: any) {
    if (ENABLE_LID_DEBUG) {
      logger.error(`[LID-DEBUG] SendWhatsAppMessageLink - Erro ao enviar para ${jid}: ${err.message}`);
    }
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessageLink;
