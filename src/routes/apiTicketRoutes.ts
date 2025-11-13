import { Router } from "express";
import tokenAuth from "../middleware/tokenAuth";
import * as ApiTicketController from "../controllers/ApiTicketController";

const apiTicketRoutes = Router();

apiTicketRoutes.post("/tickets/send", tokenAuth, ApiTicketController.store);
apiTicketRoutes.put("/tickets/:ticketId/close", tokenAuth, ApiTicketController.close);
apiTicketRoutes.put("/tickets/:ticketId/queue", tokenAuth, ApiTicketController.updateQueue);
apiTicketRoutes.post("/tickets/:ticketId/tags", tokenAuth, ApiTicketController.addTag);

export default apiTicketRoutes;