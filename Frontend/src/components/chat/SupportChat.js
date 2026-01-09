import { useState, useCallback, useEffect, useRef } from "react";
import { useChatSocket } from "../../hooks/useChatSocket";

function SupportChat({ supportUser, chatId, customerName, isChatClosed }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch previous messages
  useEffect(() => {
    if (!chatId) return;
    const token = localStorage.getItem("token");

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:5050/api/chats/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const msgList = data.messages || (Array.isArray(data) ? data : []);
        setMessages(msgList);
      } catch (err) {
        console.error("fetchMessages error:", err);
      }
    };

    fetchMessages();
  }, [chatId]);

  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { sendMessage } = useChatSocket({
    chatId,
    onMessage: handleNewMessage,
  });

  const senderId = supportUser?._id || supportUser?.id;
  const senderName = supportUser?.name || "Support";

  const handleSend = () => {
    if (!text.trim() || isChatClosed || isUploading) return;

    sendMessage({
      chatId,
      senderId,
      senderRole: "support",
      senderName,
      text,
    });

    setText("");
  };

  const handlePickFile = () => {
    if (isChatClosed || isUploading) return;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !senderId) return;

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);

      const res = await fetch("http://localhost:5050/api/chats/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      sendMessage({
        chatId,
        senderId,
        senderRole: "support",
        senderName,
        text: `Sent a file: ${data.fileName}`,
        fileUrl: data.fileUrl,
      });
    } catch (err) {
      console.error("Support upload error:", err);
      alert("Failed to upload file.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={{ margin: "0 0 10px 0" }}>Live Support</h3>

      {customerName && (
        <div style={styles.customerInfo}>
          Chatting with: <b>{customerName}</b>{" "}
          {isChatClosed && <span style={{ color: "red" }}>(Closed)</span>}
        </div>
      )}

      <div style={styles.messages}>
        {messages.map((m, i) => {
          const isImage = m.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(m.fileUrl);

          return (
            <div
              key={i}
              style={{
                ...styles.message,
                alignSelf: m.senderRole === "support" ? "flex-end" : "flex-start",
                background: m.senderRole === "support" ? "#d1ecf1" : "#f1f1f1",
              }}
            >
              <div style={styles.senderLabel}>
                {m.senderRole === "support"
                  ? m.senderName || "Support"
                  : m.senderName || "Customer"}
              </div>

              <div>{m.text}</div>

              {m.fileUrl && (
                <div style={styles.attachmentBox}>
                  {isImage ? (
                    <a href={m.fileUrl} target="_blank" rel="noreferrer">
                      <img src={m.fileUrl} alt="attachment" style={styles.imagePreview} />
                    </a>
                  ) : (
                    <a href={m.fileUrl} target="_blank" rel="noreferrer" style={styles.fileLink}>
                      Open Attachment
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.inputRow}>
        <button
          type="button"
          onClick={handlePickFile}
          disabled={isChatClosed || isUploading}
          style={{
            ...styles.attachButton,
            opacity: isChatClosed || isUploading ? 0.6 : 1,
            cursor: isChatClosed || isUploading ? "not-allowed" : "pointer",
          }}
          title={isChatClosed ? "Chat is closed" : "Attach a file"}
        >
          Attach
        </button>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={isChatClosed || isUploading}
        />

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isChatClosed ? "Chat closed." : isUploading ? "Uploading..." : "Reply..."}
          style={{
            ...styles.input,
            backgroundColor: isChatClosed ? "#eee" : "#fff",
          }}
          disabled={isChatClosed || isUploading}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        <button
          onClick={handleSend}
          style={styles.sendButton}
          disabled={isChatClosed || isUploading}
        >
          {isUploading ? "..." : "Send"}
        </button>
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
    padding: 15,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#fff",
  },
  customerInfo: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid #eee",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    paddingRight: 5,
  },
  message: {
    padding: "8px 12px",
    borderRadius: 12,
    maxWidth: "80%",
    fontSize: "14px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  senderLabel: {
    fontSize: "11px",
    fontWeight: "bold",
    marginBottom: "3px",
    color: "#333",
  },
  attachmentBox: {
    marginTop: "8px",
    borderTop: "1px solid rgba(0,0,0,0.05)",
    paddingTop: "5px",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    paddingTop: 10,
    borderTop: "1px solid #eee",
    alignItems: "center",
  },
  attachButton: {
    padding: "0 12px",
    height: 40,
    borderRadius: 8,
    border: "1px solid #ddd",
    backgroundColor: "#f8f9fa",
    fontWeight: "bold",
  },
  input: {
    flex: 1,
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #ddd",
    outline: "none",
  },
  sendButton: {
    padding: "0 20px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
    height: 40,
  },
  imagePreview: {
    maxWidth: "100%",
    maxHeight: "150px",
    borderRadius: "4px",
    marginTop: "5px",
  },
  fileLink: {
    color: "#007bff",
    fontSize: "12px",
    fontWeight: "bold",
    display: "inline-block",
    marginTop: "5px",
  },
};

export default SupportChat;
