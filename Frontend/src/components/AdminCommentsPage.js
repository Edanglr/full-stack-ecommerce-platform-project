// Frontend/src/components/AdminCommentsPage.js
import React, { useEffect, useState } from "react";
import "./AdminCommentsPage.css";

function AdminCommentsPage() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        if (!token) {
          setErrorMsg("You must be logged in as a manager.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          "http://localhost:5050/api/ratings/admin/all",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(
            data.message || "Cannot fetch ratings. Are you a manager?"
          );
          setLoading(false);
          return;
        }

        const data = await res.json();
        setRatings(data || []);
      } catch (err) {
        console.error("Admin fetch ratings error:", err);
        setErrorMsg("Unexpected error while fetching ratings.");
      } finally {
        setLoading(false);
      }
    };

    fetchRatings();
  }, [token]);

  const handleApprove = async (ratingId, approve) => {
    if (!token) {
      setErrorMsg("You must be logged in as a manager.");
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:5050/api/ratings/approve/${ratingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ approve }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to update comment status.");
        return;
      }

      setRatings((prev) =>
        prev.map((r) =>
          r._id === ratingId ? { ...r, isCommentApproved: approve } : r
        )
      );
    } catch (err) {
      console.error("Approve/Reject error:", err);
      setErrorMsg("Unexpected error while updating comment.");
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading comments...</div>;
  }

  return (
    <div className="admin-comments-container">
      <h1>Comment Moderation Panel</h1>

      {errorMsg && <p className="admin-error">{errorMsg}</p>}

      {ratings.length === 0 && !errorMsg && (
        <p>No ratings/comments found.</p>
      )}

      {ratings.length > 0 && (
        <table className="admin-comments-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>User</th>
              <th>Score</th>
              <th>Comment</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ratings.map((r) => (
              <tr key={r._id}>
                <td>{r.productId?.name || r.productId?._id || "N/A"}</td>
                <td>{r.userId?.name || r.userId?.email || "User"}</td>
                <td>{r.score}</td>
                <td style={{ maxWidth: 300 }}>
                  {r.comment ? r.comment : <i>No comment</i>}
                </td>
                <td>
                  {r.comment
                    ? r.isCommentApproved
                      ? "Approved"
                      : "Pending"
                    : "No Comment"}
                </td>
                <td>
                  {r.createdAt
                    ? new Date(r.createdAt).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {r.comment && (
                    <>
                      <button
                        className="admin-btn approve"
                        disabled={r.isCommentApproved === true}
                        onClick={() => handleApprove(r._id, true)}
                      >
                        Approve
                      </button>
                      <button
                        className="admin-btn reject"
                        disabled={r.isCommentApproved === false}
                        onClick={() => handleApprove(r._id, false)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminCommentsPage;
