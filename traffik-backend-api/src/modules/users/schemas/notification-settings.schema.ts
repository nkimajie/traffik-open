import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class NotificationChannels {
  @Prop({ default: true })
  email: boolean;

  @Prop({ default: true })
  push: boolean;

  @Prop({ default: true })
  sms: boolean;
}

const NotificationChannelsSchema =
  SchemaFactory.createForClass(NotificationChannels);

@Schema({ _id: false })
export class NotificationSettings {
  @Prop({ default: true })
  general: boolean;

  @Prop({ type: NotificationChannelsSchema, default: () => ({}) })
  updates: NotificationChannels;

  @Prop({ type: NotificationChannelsSchema, default: () => ({}) })
  promotions: NotificationChannels;
}

export const NotificationSettingsSchema =
  SchemaFactory.createForClass(NotificationSettings);
