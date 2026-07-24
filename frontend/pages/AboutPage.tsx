import React from 'react';
import { Link } from 'react-router-dom';
import { EditableStaticPage } from '../components/EditableStaticPage';

const AboutPage: React.FC = () => {
  const fallback = (
    <>
      <p className="text-gray-600 mb-4">
        China Factory Map helps international buyers discover manufacturing suppliers across major industrial belts in
        China, review credentials, and contact factories quickly.
      </p>
      <p className="text-gray-600 mb-4">
        We are continuously improving listing quality, verification workflows, and admin tools so sourcing teams can
        work with clearer factory data.
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
