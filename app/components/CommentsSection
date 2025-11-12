"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

interface CommentProps {
  pickId: string;
  userName: string;
}

export default function CommentsSection({ pickId, userName }: CommentProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "comments"),
      where("pickId", "==", pickId),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(commentData);
    });

    return () => unsubscribe();
  }, [pickId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addDoc(collection(db, "comments"), {
        pickId,
        userName,
        text: newComment,
        timestamp: serverTimestamp(),
      });
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-700 pt-3">
      <h4 className="text-sm text-gray-400 mb-2">Comments</h4>

      <div className="space-y-2">
        {comments.length === 0 && (
          <p className="text-xs text-gray-500">No comments yet.</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="text-sm">
            <span className="text-orange-400 font-medium">
              {comment.userName}:
            </span>{" "}
            <span className="text-gray-300">{comment.text}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 px-3 py-1 bg-gray-800 text-white text-sm rounded-md border border-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          onClick={handleAddComment}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1 rounded-md"
        >
          Post
        </button>
      </div>
    </div>
  );
}
