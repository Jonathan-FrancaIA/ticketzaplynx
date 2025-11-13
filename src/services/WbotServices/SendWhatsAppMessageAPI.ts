import { delay, WAMessage } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { ENABLE_LID_DEBUG } from "../../config/debug";
import { normalizeJid } from "../../utils";
import { isNil } from "lodash";

interface Request {
  body: string;
  whatsappId: number;
  contact: Contact;
  quotedMsg?: Message;
  msdelay?: number;
}

const SendWhatsAppMessage = async ({
  body,
  whatsappId,
  contact,
  quotedMsg,
  msdelay
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await getWbot(whatsappId);

  // --- 🔧 Tratamento completo para contatos LID ---
  let jid: string;
  const isLidContact = contact.number.includes("@lid");

  if (isLidContact) {
    // Contato LID — garantir formato correto (sem duplo sufixo)
    jid = contact.number.replace("@lid@s.whatsapp.net", "@lid");

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendMessageAPI - Contato LID detectado, usando JID: ${jid}`);
    }
  } else if (contact.remoteJid && !contact.remoteJid.includes("@lid@s.whatsapp.net")) {
    // Caso tenha um remoteJid válido
    jid = contact.remoteJid;

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendMessageAPI - Usando remoteJid armazenado: ${jid}`);
    }
  } else {
    // Fallback: constrói o JID manualmente
    jid = `${contact.number}@${contact.isGroup ? "g.us" : "s.whatsapp.net"}`;

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendMessageAPI - Construindo JID manualmente: ${jid}`);
    }
  }

  jid = normalizeJid(jid);

  if (ENABLE_LID_DEBUG) {
    logger.info(`[LID-DEBUG] SendMessageAPI - JID final normalizado: ${jid}`);
    logger.info(`[LID-DEBUG] SendMessageAPI - Contact number: ${contact.number}`);
    logger.info(`[LID-DEBUG] SendMessageAPI - Contact remoteJid: ${contact.remoteJid}`);
    logger.info(`[LID-DEBUG] SendMessageAPI - IsGroup: ${contact.isGroup}`);
    logger.info(`[LID-DEBUG] SendMessageAPI - QuotedMsg: ${quotedMsg ? "SIM" : "NÃO"}`);
  }

  // --- 📎 Tratamento de mensagens respondidas (quoted) ---
  if (quotedMsg) {
    const quotedId: any = (quotedMsg as any)?.id ?? quotedMsg;
    let chatMessages: Message | null = null;

    if (quotedId !== undefined && quotedId !== null && String(quotedId).trim() !== "") {
      chatMessages = await Message.findOne({ where: { id: quotedId } });
    }

    if (chatMessages) {
      const msgFound = JSON.parse(chatMessages.dataJson);

      if (msgFound.message.extendedTextMessage !== undefined) {
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              extendedTextMessage: msgFound.message.extendedTextMessage
            }
          }
        };
      } else {
        options = {
          quoted: {
            key: msgFound.key,
            message: {
              conversation: msgFound.message.conversation
            }
          }
        };
      }

      if (ENABLE_LID_DEBUG) {
        logger.info(`[LID-DEBUG] SendMessageAPI - ContextInfo configurado para resposta`);
      }
    }
  }

  // --- 💬 Envio da mensagem ---
  try {
    await delay(msdelay);

    const sentMessage = await wbot.sendMessage(
      jid,
      {
        text: formatBody(body, contact),
        contextInfo: {
          forwardingScore: 0,
          isForwarded: false
        }
      },
      {
        ...options
      }
    );

    if (ENABLE_LID_DEBUG) {
      logger.info(`[LID-DEBUG] SendMessageAPI - Mensagem enviada com sucesso para ${jid}`);
    }

    return sentMessage;
  } catch (err: any) {
    if (ENABLE_LID_DEBUG) {
      logger.error(`[LID-DEBUG] SendMessageAPI - Erro ao enviar para ${jid}: ${err.message}`);
    }

    // Tentativa extra caso erro de criptografia de grupo (como no outro arquivo)
    if (err.message && err.message.includes("senderMessageKeys")) {
      try {
        if (ENABLE_LID_DEBUG) {
          logger.info(`[LID-DEBUG] SendMessageAPI - Tentando envio sem criptografia para grupo ${jid}`);
        }

        const sentMessage = await wbot.sendMessage(jid, { text: formatBody(body, contact) });

        if (ENABLE_LID_DEBUG) {
          logger.info(`[LID-DEBUG] SendMessageAPI - Sucesso no envio sem criptografia`);
        }

        return sentMessage;
      } catch (finalErr) {
        Sentry.captureException(finalErr);
        if (ENABLE_LID_DEBUG) {
          logger.error(`[LID-DEBUG] SendMessageAPI - Falha no envio sem criptografia: ${finalErr.message}`);
        }
        throw new AppError("ERR_SENDING_WAPP_MSG_GROUP_CRYPTO");
      }
    }

    Sentry.captureException(err);
    console.error(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
