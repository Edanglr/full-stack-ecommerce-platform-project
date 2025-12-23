import Chat from "../models/Chat.js";
import User from "../models/User.js";

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    socket.on("joinChat", ({ chatId }) => {
      socket.join(chatId);
      console.log(`Socket ${socket.id} joined chat ${chatId}`);
    });

    socket.on("sendMessage", async (data) => {
      try {
        // 1️⃣ Gönderen kullanıcının adını DB'den al
        const user = await User.findById(data.senderId).select("name");

        const message = {
          chatId: data.chatId,
          senderId: data.senderId,
          senderRole: data.senderRole,
          senderName: user?.name || "Unknown",
          text: data.text,
          timestamp: new Date(),
        };

        // 2️⃣ Chat odasındaki herkese gönder
        io.to(data.chatId).emit("receiveMessage", message);

        // 3️⃣ Tüm adminlere bildirim
        io.emit("adminNewMessage", message);

        // 4️⃣ DB’ye kaydet (⚠️ customerId DÜZELTİLDİ)
        const customerId =
          data.senderRole === "customer"
            ? data.senderId               // ✅ GERÇEK user._id
            : data.chatId.replace("chat-", "");

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
                senderName: message.senderName,
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
