import mongoose, {Schema, model} from "mongoose";

export interface IScript {
    chatId: number;
    wallet: string;
    twitterUsername: string;
    keysToBuy: number;
    isActive: boolean;
}

const ScriptSchema = new Schema<IScript>({
    chatId: {
        type: Number,
        required: true,
        trim: true,
    },
    wallet: {
        type: String,
        required: true,
        trim: true,
    },
    twitterUsername: {
        type: String,
        required: true,
        trim: true,
    },
    keysToBuy: {
        type: Number,
        required: true,
        trim: true,
    },
    isActive: {
        type: Boolean,
        required: true,
    }
}, {timestamps: true});

const Script =
  (mongoose.models.Script as mongoose.Model<IScript>) ||
  model<IScript>("Script", ScriptSchema);


export default Script;