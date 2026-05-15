import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

interface TrendsSearchFormProps {
  onSearch: (params: {
    jobTitle: string;
    location: string;
    experienceLevel: string;
    salaryTarget: string;
  }) => void;
  isLoading: boolean;
}

export function TrendsSearchForm({
  onSearch,
  isLoading,
}: TrendsSearchFormProps) {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [salaryTarget, setSalaryTarget] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) return;
    onSearch({ jobTitle, location, experienceLevel, salaryTarget });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <div>
          <Label htmlFor="job-title">Job Title *</Label>
          <Input
            id="job-title"
            placeholder="e.g. Senior Frontend Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="e.g. Remote, NYC"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="experience">Experience</Label>
          <select
            id="experience"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
          >
            <option value="">Any level</option>
            <option value="entry">Entry Level</option>
            <option value="mid">Mid Level</option>
            <option value="senior">Senior Level</option>
            <option value="executive">Executive</option>
          </select>
        </div>
        <div>
          <Label htmlFor="salary">Target Salary (USD)</Label>
          <Input
            id="salary"
            type="number"
            placeholder="e.g. 120000"
            value={salaryTarget}
            onChange={(e) => setSalaryTarget(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={isLoading}>
        <Sparkles />
        {isLoading ? "Analyzing Market..." : "Analyze Market"}
      </Button>
    </form>
  );
}
