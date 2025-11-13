import { Request, Response } from "express";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessageAPI from "../services/WbotServices/SendWhatsAppMessageAPI";
import { verifyMessage } from "../services/WbotServices/wbotMessageListener";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import logger from "../utils/logger";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import TicketTag from "../models/TicketTag";
import { getIO } from "../libs/socket";

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { number, body, queueId } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new AppError("Authorization header not found");
    }
    const [, token] = authHeader.split(" ");
    const whatsapp = await Whatsapp.findOne({ where: { token } });

    if (!whatsapp) {
        throw new AppError("Whatsapp not found");
    }

    const companyId = whatsapp.companyId;

    if (!number || !body) {
        throw new AppError("Missing params: number or body");
    }

    try {
        const validNumber: any = await CheckContactNumber(number, companyId);

        const contactData = {
            name: `${validNumber.jid.replace(/\D/g, "")}`,
            number: validNumber.jid.split("@")[0],
            profilePicUrl: "",
            isGroup: false,
            companyId,
            whatsappId: whatsapp.id,
            remoteJid: validNumber.jid
        };

        const contact = await CreateOrUpdateContactService(contactData);

        const ticket = await FindOrCreateTicketService(
            contact,
            whatsapp,
            0,
            companyId,
            queueId, // passing queueId here
            null,
            null,
            "whatsapp"
        );

        const sentMessage = await SendWhatsAppMessageAPI({ body: `\u200e${body}`, whatsappId: whatsapp.id, contact: ticket.contact });
        await verifyMessage(sentMessage, ticket, ticket.contact);

        return res.status(200).json(ticket);
    } catch (err) {
        logger.error(err);
        throw new AppError(err.message);
    }
};

export const close = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { userId } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new AppError("Authorization header not found");
    }
    const [, token] = authHeader.split(" ");
    const whatsapp = await Whatsapp.findOne({ where: { token } });

    if (!whatsapp) {
        throw new AppError("Whatsapp not found");
    }
    const companyId = whatsapp.companyId;

    if (!userId) {
        throw new AppError("Missing param: userId");
    }

    try {
        const { ticket } = await UpdateTicketService({
            ticketId,
            ticketData: { status: "closed", userId },
            companyId
        });

        return res.status(200).json(ticket);
    } catch (err) {
        logger.error(err);
        throw new AppError(err.message);
    }
};

export const updateQueue = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { queueId, userId } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new AppError("Authorization header not found");
    }
    const [, token] = authHeader.split(" ");
    const whatsapp = await Whatsapp.findOne({ where: { token } });

    if (!whatsapp) {
        throw new AppError("Whatsapp not found");
    }
    const companyId = whatsapp.companyId;

    if (!queueId || !userId) {
        throw new AppError("Missing params: queueId or userId");
    }

    try {
        const { ticket } = await UpdateTicketService({
            ticketId,
            ticketData: { queueId, userId },
            companyId
        });

        return res.status(200).json(ticket);
    } catch (err) {
        logger.error(err);
        throw new AppError(err.message);
    }
};

export const addTag = async (req: Request, res: Response): Promise<Response> => {
    const { ticketId } = req.params;
    const { tags } = req.body; // expecting an array of tag ids

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new AppError("Authorization header not found");
    }
    const [, token] = authHeader.split(" ");
    const whatsapp = await Whatsapp.findOne({ where: { token } });

    if (!whatsapp) {
        throw new AppError("Whatsapp not found");
    }
    const companyId = whatsapp.companyId;

    if (!tags || !Array.isArray(tags)) {
        throw new AppError("Missing or invalid param: tags (must be an array of tag ids)");
    }

    try {
        // First, remove all existing tags for the ticket
        await TicketTag.destroy({ where: { ticketId } });

        // Then, add the new tags
        const ticketTags = tags.map((tagId: number) => ({ ticketId, tagId }));
        await TicketTag.bulkCreate(ticketTags);

        const ticket = await ShowTicketService(ticketId, companyId);

        const io = getIO();
        io.of(String(companyId))
          .emit(`company-${companyId}-ticket`, {
            action: "update",
            ticket
          });

        return res.status(200).json(ticket);
    } catch (err) {
        logger.error(err);
        throw new AppError(err.message);
    }
};
