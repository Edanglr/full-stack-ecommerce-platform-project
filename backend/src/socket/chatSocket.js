import Chat from "../models/Chat.js"; // 🔴 EKLENDİ

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    socket.on("joinChat", ({ chatId }) => {
      socket.join(chatId);
      console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });

    socket.on("sendMessage", async (data) => {
      const message = {
        chatId: data.chatId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        text: data.text,
        timestamp: new Date(),
      };

      // 1️⃣ Chat room’daki kullanıcılara gönder
      io.to(data.chatId).emit("receiveMessage", message);

      // 2️⃣ TÜM ADMIN’LERE HABER VER
      io.emit("adminNewMessage", message);

      // 3️⃣ 🔴 DB'YE KAYDET (EN ÖNEMLİ EKLEME)
      try {
        const customerId = data.chatId.replace("chat-", "");

        await Chat.findOneAndUpdate(
          { chatId: data.chatId },
          {
            $setOnInsert: {
              chatId: data.chatId,
              customerId,
            },
            $push: {
              messages: {
                senderId: message.senderId,
                senderRole: message.senderRole,
                text: message.text,
                timestamp: message.timestamp,
              },
            },
            $set: {
              lastMessageAt: message.timestamp,
            },
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error("❌ Chat DB save error:", err.message);
      }
    });

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });
};

export default chatSocket;
