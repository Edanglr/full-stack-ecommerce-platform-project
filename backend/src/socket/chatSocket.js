// backend/src/socket/chatSocket.js
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const chatSocket = (io) => {
  io.on("connection", (socket) => {

    socket.on("joinChat", ({ chatId }) => {
      socket.join(chatId);
    });

    socket.on("sendMessage", async (data) => {
      try {
        if (!data.chatId || !data.text || !data.senderId) {
          console.error("❌ Missing Data:", data);
          return;
        }

        let senderName = data.senderName || "Unknown";

        try {
          if (data.senderId.match(/^[0-9a-fA-F]{24}$/)) {
             const user = await User.findById(data.senderId).select("name");
             if (user) senderName = user.name;
          }
        } catch (err) {
          console.warn("⚠️ Username warning:", err.message);
        }

        // 1️⃣ Mesaj objesini hazırla
        const messageData = {
          senderId: data.senderId,
          senderRole: data.senderRole || "customer",
          senderName: senderName,
          text: data.text,
          fileUrl: data.fileUrl || null,
          timestamp: new Date(),
        };

        // 2️⃣ ✅ KRİTİK DÜZELTME: 'newMessage' ismini kullanın
        // Frontend tarafındaki handleNewMessage fonksiyonu bu ismi bekliyor.
        io.to(data.chatId).emit("newMessage", messageData);
        
        // Admin panelindeki genel bildirim için
        io.emit("adminNewMessage", { ...messageData, chatId: data.chatId });

        // 3️⃣ Veritabanına Kaydet
        const customerId = data.senderRole === "customer"
            ? data.senderId
            : data.chatId.replace("chat-", "");

        await Chat.findOneAndUpdate(
          { chatId: data.chatId },
          {
            $setOnInsert: {
              chatId: data.chatId,
              customerId: customerId,
            },
            $push: {
              messages: messageData,
            },
            $set: {
              lastMessageAt: messageData.timestamp,
              status: "active" 
            },
          },
          { upsert: true, new: true, runValidators: true }
        );

        console.log(`✅ Message sent and saved to DB! ChatID: ${data.chatId}`);

      } catch (err) {
        console.error("❌ Socket Error:", err);
      }
    });

    socket.on("disconnect", () => { });
  });
};

export default chatSocket;