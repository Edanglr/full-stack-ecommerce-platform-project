import { useState, useCallback } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

function CustomerChat({ user }) {
  // chat id (her kullanıcı için sabit)
  const chatId = `chat-${user._id || user.id}`;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  const handleSend = () => {
    if (!text.trim()) return;

    sendMessage({
      chatId,
      senderId: user._id || user.id,
      senderRole: "customer",
      text,
    });

    setText("");
  };

  return (
    <>
      {/* 🟢 CHAT WINDOW */}
      {open && (
        <div style={styles.chatWindow}>
          <div style={styles.header}>
            <span>Live Support</span>
            <button
              onClick={() => setOpen(false)}
              style={styles.closeBtn}
            >
              ✕
            </button>
          </div>

          <div style={styles.messages}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.message,
                  alignSelf:
                    m.senderRole === "customer"
                      ? "flex-end"
                      : "flex-start",
                }}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div style={styles.inputRow}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              style={styles.input}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      )}

      {/* 🔵 FLOATING BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        style={styles.floatingButton}
        title="Live Support"
      >
        💬
      </button>
    </>
  );
}

const styles = {
  floatingButton: {
    position: "fixed",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "#000",
    color: "#fff",
    fontSize: "26px",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    zIndex: 1000,
  },

  chatWindow: {
    position: "fixed",
    bottom: 90,
    right: 20,
    width: 320,
    height: 420,
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    zIndex: 1000,
  },

  header: {
    padding: "10px 12px",
    background: "#000",
    color: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "bold",
  },

  closeBtn: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "18px",
    cursor: "pointer",
  },

  messages: {
    flex: 1,
    padding: 10,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  message: {
    padding: "6px 10px",
    borderRadius: 10,
    background: "#f1f1f1",
    maxWidth: "80%",
    fontSize: "14px",
  },

  inputRow: {
    display: "flex",
    padding: 8,
    borderTop: "1px solid #ddd",
    gap: 6,
  },

  input: {
    flex: 1,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #ccc",
  },
};

export default CustomerChat;
