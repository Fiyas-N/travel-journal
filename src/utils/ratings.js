export const getReviewCount = (destination) => {
  if (destination?.ratings && typeof destination.ratings === 'object') {
    return Object.keys(destination.ratings).length;
  }
  return 0;
}; 