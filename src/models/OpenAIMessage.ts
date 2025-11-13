
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import Ticket from "./Ticket";

@Table
class OpenAIMessage extends Model<OpenAIMessage> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Column(DataType.TEXT)
  content: string;

  @Column
  from: string;

  @Column
  to: string;

  @Column(DataType.JSON)
  message: object;
}

export default OpenAIMessage;
