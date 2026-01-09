// backend/src/socket/chatSocket.js
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("joinChat", ({ chatId }) => {
      if (!chatId) return;
      socket.join(chatId);
    });

    socket.on("sendMessage", async (data) => {
      try {
        if (!data?.chatId || !data?.text || !data?.senderId) {
          console.error("Missing socket message data:", data);
          return;
        }

        let senderName = data.senderName || "Unknown";

        // If senderId looks like an ObjectId, try to load the user's name.
        try {
          if (/^[0-9a-fA-F]{24}$/.test(String(data.senderId))) {
            const user = await User.findById(data.senderId).select("name").lean();
            if (user?.name) senderName = user.name;
          }
        } catch (err) {
          console.warn("Could not resolve sender name:", err.message);
        }

        const messageData = {
          senderId: data.senderId,
          senderRole: data.senderRole || "customer",
          senderName,
          text: data.text,
          fileUrl: data.fileUrl || null,
          timestamp: new Date(),
        };

        // Emit to the specific chat room (frontend listens to "newMessage").
        io.to(data.chatId).emit("newMessage", messageData);

        // Global notification for admin/support panels.
        io.emit("adminNewMessage", { ...messageData, chatId: data.chatId });

        // Persist message in DB.
        const customerId =
          messageData.senderRole === "customer"
            ? messageData.senderId
            : String(data.chatId).replace("chat-", "");

        await Chat.findOneAndUpdate(
          { chatId: data.chatId },
          {
            $setOnInsert: {
              chatId: data.chatId,
              customerId,
            },
            $push: { messages: messageData },
            $set: {
              lastMessageAt: messageData.timestamp,
              status: "active",
            },
          },
          { upsert: true, new: true, runValidators: true }
        );

        console.log(`Message saved. ChatID: ${data.chatId}`);
      } catch (err) {
        console.error("Socket sendMessage error:", err);
      }
    });

    socket.on("disconnect", () => {});
  });
};

export default chatSocket;
