"use client";

import { useParams } from "wouter";
import { Car, MapPin, Users } from "lucide-react";
import RatingsList from "./RatingsList";

export default function RatingsPage() {
  const params = useParams();
  const moduleType = (params.moduleType as 'car' | 'tour') || 'car';
  const moduleIdStr = params.moduleId;
  if (!moduleIdStr) return <div>Module ID required</div>;
  const moduleId = parseInt(moduleIdStr);
  
  // Mock data - replace with actual car/tour query
  const mockData = {
    car: { title: "Mercedes S-Class Rental", type: "car" },
    tour: { title: "Eiffel Tower VIP Tour", type: "tour" }
  };

  const moduleData = mockData[moduleType] || { title: "Item" };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          {moduleType === 'car' ? <Car className="size-6" /> : <MapPin className="size-6" />}
          <h1 className="text-3xl font-bold">{moduleData.title}</h1>
        </div>
      </div>
      
      <RatingsList 
        moduleType={moduleType} 
        moduleId={moduleId}
        moduleTitle={moduleData.title}
      />
    </div>
  );
}

