"use client";

// @ts-ignore - types are bundled with react-pdf
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

// Types for export data
interface ExportGuest {
  name: string;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  guestType: string;
}

interface ExportTable {
  id: string;
  name: string;
  guests: ExportGuest[];
  explanations: string[];
}

interface ExportData {
  event: {
    name: string;
    date: string | null;
    venue: string | null;
    tableCount: number;
    seatsPerTable: number;
    totalGuests: number;
  };
  plan: {
    version: number;
    createdAt: string;
    metrics: {
      novelty: number;
      diversity: number;
      balance: number;
      transaction: number;
      weighted: number;
    };
    overallExplanation: string;
  };
  tables: ExportTable[];
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#4F46E5",
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1F2937",
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: "#F3F4F6",
    padding: 8,
  },
  metricsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    backgroundColor: "#F9FAFB",
    padding: 15,
    borderRadius: 4,
  },
  metricBox: {
    alignItems: "center",
  },
  metricValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#4F46E5",
  },
  metricLabel: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 2,
  },
  explanation: {
    fontSize: 10,
    color: "#374151",
    fontStyle: "italic",
    marginBottom: 15,
    lineHeight: 1.4,
  },
  tableCard: {
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
  },
  tableHeader: {
    backgroundColor: "#4F46E5",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tableName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  tableCount: {
    fontSize: 10,
    color: "#E0E7FF",
  },
  guestRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  guestName: {
    fontSize: 10,
    color: "#1F2937",
    width: "30%",
  },
  guestCompany: {
    fontSize: 10,
    color: "#6B7280",
    width: "25%",
  },
  guestDepartment: {
    fontSize: 10,
    color: "#6B7280",
    width: "25%",
  },
  guestType: {
    fontSize: 8,
    color: "#FFFFFF",
    backgroundColor: "#6B7280",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    width: "20%",
    textAlign: "center",
  },
  buyerType: {
    backgroundColor: "#059669",
  },
  sellerType: {
    backgroundColor: "#2563EB",
  },
  catalystType: {
    backgroundColor: "#7C3AED",
  },
  tableExplanations: {
    padding: 10,
    backgroundColor: "#F9FAFB",
  },
  tableExplanation: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
  pageNumber: {
    fontSize: 8,
    color: "#9CA3AF",
  },
});

// Helper to format score as percentage
const formatScore = (score: number): string => {
  return `${Math.round(score * 100)}%`;
};

// Helper to format date
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "TBD";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// PDF Document Component
const SeatingPlanDocument = ({ data }: { data: ExportData }) => (
  <Document>
    {/* Cover Page */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{data.event.name}</Text>
        <Text style={styles.subtitle}>Seating Plan</Text>
        {data.event.date && (
          <Text style={styles.subtitle}>Date: {formatDate(data.event.date)}</Text>
        )}
        {data.event.venue && (
          <Text style={styles.subtitle}>Venue: {data.event.venue}</Text>
        )}
        <Text style={styles.subtitle}>
          {data.event.totalGuests} guests across {data.event.tableCount} tables
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Optimization Metrics</Text>
      <View style={styles.metricsContainer}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{formatScore(data.plan.metrics.weighted)}</Text>
          <Text style={styles.metricLabel}>Overall Score</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{formatScore(data.plan.metrics.novelty)}</Text>
          <Text style={styles.metricLabel}>New Connections</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{formatScore(data.plan.metrics.diversity)}</Text>
          <Text style={styles.metricLabel}>Diversity</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{formatScore(data.plan.metrics.balance)}</Text>
          <Text style={styles.metricLabel}>Balance</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{formatScore(data.plan.metrics.transaction)}</Text>
          <Text style={styles.metricLabel}>Business</Text>
        </View>
      </View>

      <Text style={styles.explanation}>{data.plan.overallExplanation}</Text>

      <Text style={styles.sectionTitle}>Table Assignments</Text>

      {data.tables.map((table) => (
        <View key={table.id} style={styles.tableCard} wrap={false}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableName}>{table.name}</Text>
            <Text style={styles.tableCount}>
              {table.guests.length}/{data.event.seatsPerTable} seats
            </Text>
          </View>
          {table.guests.map((guest, idx) => (
            <View key={idx} style={styles.guestRow}>
              <Text style={styles.guestName}>{guest.name}</Text>
              <Text style={styles.guestCompany}>{guest.company || "-"}</Text>
              <Text style={styles.guestDepartment}>{guest.department || "-"}</Text>
              <Text
                style={[
                  styles.guestType,
                  guest.guestType === "BUYER" ? styles.buyerType : {},
                  guest.guestType === "SELLER" ? styles.sellerType : {},
                  guest.guestType === "CATALYST" ? styles.catalystType : {},
                ]}
              >
                {guest.guestType}
              </Text>
            </View>
          ))}
          {table.explanations.length > 0 && (
            <View style={styles.tableExplanations}>
              {table.explanations.map((exp, idx) => (
                <Text key={idx} style={styles.tableExplanation}>
                  • {exp}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>
          Generated by SeatIQ on {new Date().toLocaleDateString()}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </Page>
  </Document>
);

// Export function to generate and download PDF
export async function generateSeatingPDF(data: ExportData): Promise<void> {
  const blob = await pdf(<SeatingPlanDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.event.name.replace(/[^a-z0-9]/gi, "_")}_seating_plan.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type { ExportData };
