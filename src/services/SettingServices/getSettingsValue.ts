import Setting from "../../models/Setting";

export const getSettingsValue = async (key: string): Promise<string | undefined> => {
  const setting = await Setting.findOne({
    where: { key },
  });
  return setting?.value;
};
