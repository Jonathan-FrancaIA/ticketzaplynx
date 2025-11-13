import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const tableDescription = await queryInterface.describeTable("ChatUsers") as { [key: string]: any };

    if (!tableDescription.companyId) {
      await queryInterface.addColumn("ChatUsers", "companyId", {
        type: DataTypes.INTEGER,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true,
      });

      // Populate companyId from the related Chat
      await queryInterface.sequelize.query(`
        UPDATE "ChatUsers" 
        SET "companyId" = (
          SELECT "companyId" 
          FROM "Chats" 
          WHERE "Chats"."id" = "ChatUsers"."chatId"
        )
      `);
    } else {
      console.log("A coluna 'companyId' já existe. Ignorando a criação.");
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableDescription = await queryInterface.describeTable("ChatUsers") as { [key: string]: any };

    if (tableDescription.companyId) {
      await queryInterface.removeColumn("ChatUsers", "companyId");
    } else {
      console.log("A coluna 'companyId' não existe. Ignorando a remoção.");
    }
  }
};