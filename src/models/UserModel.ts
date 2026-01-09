import mongoose, { Schema, model} from "mongoose";

export interface IUser {
    chatId: number;
    walletPk: string;
}

const UserSchema = new Schema<IUser>({
    chatId: {
        type: Number,
        required: true,
        trim: true,
        unique:true
    },
    walletPk: {
        type: String,
        required: true,
        trim: true,
    }
}, {timestamps: true});

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  model<IUser>("User", UserSchema);


export default User;