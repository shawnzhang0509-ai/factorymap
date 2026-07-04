import React from 'react';
import { Link } from 'react-router-dom';
import { EditableStaticPage } from '../components/EditableStaticPage';

const AboutPage: React.FC = () => {
  const fallback = (
    <>
      <p className="text-gray-600 mb-4">
        MBTI Social Map helps you discover people nearby on a map, filter by personality type, and connect for
        friendship, dating, or shared activities.
      </p>
      <p className="text-gray-600 mb-4">
        Put your pin on the map, share your MBTI type and interests, and find others who match your vibe.
      </p>
    </>
  );

  return (
    <EditableStaticPage
      page="about"
      title="About Us"
      fallback={fallback}
      backLink={
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
        >
          Back to Home
        </Link>
      }
    />
  );
};

export default AboutPage;
