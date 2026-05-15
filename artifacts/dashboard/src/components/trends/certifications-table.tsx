import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import type { MarketAnalysis } from "@workspace/api-client-react";

interface CertificationsTableProps {
  certifications: MarketAnalysis["certifications"];
}

export function CertificationsTable({
  certifications,
}: CertificationsTableProps) {
  const demandColors: Record<string, string> = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-gray-100 text-gray-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Award />
          In-Demand Certifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certification</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Demand</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certifications.map((cert) => (
              <TableRow key={cert.name}>
                <TableCell>{cert.name}</TableCell>
                <TableCell>{cert.provider}</TableCell>
                <TableCell>
                  <Badge>
                    {cert.demand}
                  </Badge>
                </TableCell>
                <TableCell>
                  {cert.estimatedValue}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
