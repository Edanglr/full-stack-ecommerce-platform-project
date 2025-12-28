import Chat from "../models/Chat.js";
import User from "../models/User.js";

const chatSocket = (io) => {
  io.on("connection", (socket) => {
    // console.log("🟢 Socket connected:", socket.id); // Log kirliliği olmaması için kapattım

    socket.on("joinChat", ({ chatId }) => {
      socket.join(chatId);
      // console.log(`Socket joined ${chatId}`);
    });

    socket.on("sendMessage", async (data) => {
      try {
        /* 🛡️ GÜVENLİK KONTROLÜ: Veriler dolu mu? */
        if (!data.chatId || !data.text || !data.senderId) {
          console.error("❌ Eksik Veri:", data);
          return;
        }

        let senderName = "Unknown";

        // 1️⃣ Kullanıcı İsmini Bulmaya Çalış (Hata olursa patlamasın)
        try {
          // Eğer senderId geçerli bir ID formatında değilse findById hata verir, onu yakalıyoruz.
          if (data.senderId.match(/^[0-9a-fA-F]{24}$/)) {
             const user = await User.findById(data.senderId).select("name");
             if (user) senderName = user.name;
          } else {
             // Eğer customer değilse ve ID formatı farklıysa (admin vs) gelen ismi kullan
             senderName = data.senderName || "Support"; 
          }
        } catch (err) {
          console.warn("⚠️ Kullanıcı adı bulunamadı, varsayılan kullanılıyor:", err.message);
        }

        const messageData = {
          senderId: data.senderId,
          senderRole: data.senderRole || "customer", // Role boşsa customer varsay
          senderName: senderName,
          text: data.text,
          timestamp: new Date(),
        };

        // 2️⃣ Mesajı anında ilet (Socket)
        io.to(data.chatId).emit("receiveMessage", messageData);
        io.emit("adminNewMessage", { ...messageData, chatId: data.chatId });

        // 3️⃣ VERİTABANINA KAYDET
        // Customer ID belirle
        const customerId =
          data.senderRole === "customer"
            ? data.senderId
            : data.chatId.replace("chat-", "");

        await Chat.findOneAndUpdate(
          { chatId: data.chatId },
          {
            $setOnInsert: {
              chatId: data.chatId,
              customerId: customerId, // Şemada required: true
            },
            $push: {
              messages: messageData, // Şemaya uygun obje
            },
            $set: {
              lastMessageAt: messageData.timestamp,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );

        console.log(`✅ Mesaj Kaydedildi! ChatID: ${data.chatId}`);

      } catch (err) {
        console.error("❌ DB SAVE HATASI:", err);
        // Hata detayını gör ki sorunu anlayalım
        if (err.name === 'ValidationError') {
           console.error("Validasyon Detayı:", err.errors);
        }
      }
    });

    socket.on("disconnect", () => {
      // console.log("🔴 Disconnected");
    });
  });
};

export default chatSocket;