import { useState, useCallback, useEffect } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

/*
  Support (Admin / Manager) için chat component’i
*/
function SupportChat({ supportUser, chatId, customerName }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  /* 🔹 1) CHAT AÇILINCA: ESKİ MESAJLARI ÇEK */
  useEffect(() => {
    if (!chatId) return;

    const token = localStorage.getItem("token");

    const fetchMessages = async () => {
      try {
        const res = await fetch(
          `http://localhost:5050/api/chats/${chatId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("fetchMessages error:", err);
      }
    };

    fetchMessages();
  }, [chatId]);

  /* 🔹 2) SOCKET’TEN GELEN YENİ MESAJLAR */
  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  /* 🔹 3) ADMIN MESAJ GÖNDER */
  const handleSend = () => {
    if (!text.trim()) return;

    sendMessage({
      chatId,
      senderId: supportUser._id || supportUser.id,
      senderRole: "support",
      text,
    });

    setText("");
  };

  return (
    <div style={styles.container}>
      <h3>Live Support</h3>

      {customerName && (
        <div style={styles.customerInfo}>
          customer: <b>{customerName}</b>
        </div>
      )}

      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              alignSelf:
                m.senderRole === "support"
                  ? "flex-end"
                  : "flex-start",
              background:
                m.senderRole === "support" ? "#d1ecf1" : "#f1f1f1",
            }}
          >
            <b>{m.senderRole}:</b> {m.text}
          </div>
        ))}
      </div>

      <div style={styles.inputRow}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply to customer..."
          style={styles.input}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "100%",
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: 10,
    display: "flex",
    flexDirection: "column",
  },
  customerInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 10,
  },
  message: {
    padding: "6px 10px",
    borderRadius: 8,
    maxWidth: "80%",
    fontSize: "14px",
  },
  inputRow: {
    display: "flex",
    gap: 6,
  },
  input: {
    flex: 1,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #ccc",
  },
};

export default SupportChat;
