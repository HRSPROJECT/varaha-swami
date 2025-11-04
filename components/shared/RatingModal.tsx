import React, { useState, useEffect } from 'react';
import { OrderRating } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

interface RatingModalProps {
  orderId: number;
  existingRating?: OrderRating;
  onClose: () => void;
  onRatingSubmitted: (rating: OrderRating) => void;
}

const RatingModal: React.FC<RatingModalProps> = ({ orderId, existingRating, onClose, onRatingSubmitted }) => {
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [reviewMessage, setReviewMessage] = useState(existingRating?.review_message || '');
  const [improvementSuggestion, setImprovementSuggestion] = useState(existingRating?.improvement_suggestion || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setLoading(true);
    try {
      const ratingData = {
        order_id: orderId,
        customer_id: (await supabase.auth.getUser()).data.user?.id,
        rating,
        review_message: reviewMessage || null,
        improvement_suggestion: improvementSuggestion || null,
      };

      let result;
      if (existingRating) {
        result = await supabase
          .from('order_ratings')
          .update(ratingData)
          .eq('id', existingRating.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('order_ratings')
          .insert(ratingData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast.success(existingRating ? 'Rating updated!' : 'Rating submitted!');
      onRatingSubmitted(result.data);
      onClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">
          {existingRating ? 'Edit Rating' : 'Rate Your Order'}
        </h3>
        
        <form onSubmit={handleSubmit}>
          {/* Star Rating */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl transition-colors ${
                    star <= rating ? 'text-yellow-400' : 'text-gray-300'
                  } hover:text-yellow-300`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {rating > 0 && `${rating} star${rating > 1 ? 's' : ''} selected`}
            </p>
          </div>

          {/* Review Message */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Review (Optional)</label>
            <textarea
              value={reviewMessage}
              onChange={(e) => setReviewMessage(e.target.value)}
              placeholder="How was your experience?"
              className="w-full p-2 border rounded-lg resize-none"
              rows={3}
            />
          </div>

          {/* Improvement Suggestion */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Suggestions for Improvement (Optional)</label>
            <textarea
              value={improvementSuggestion}
              onChange={(e) => setImprovementSuggestion(e.target.value)}
              placeholder="Any suggestions to improve our service?"
              className="w-full p-2 border rounded-lg resize-none"
              rows={2}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || rating === 0}
              className="flex-1 py-2 px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : existingRating ? 'Update' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;
