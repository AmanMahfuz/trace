import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Resume } from '@/lib/schemas';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: 'rgb(26, 26, 26)', lineHeight: 1.3 },
  header: { marginBottom: 14, textAlign: 'center' },
  name: { fontSize: 18, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  contact: { fontSize: 9, marginTop: 4, color: 'rgb(68, 68, 68)' },
  section: { marginTop: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgb(170, 170, 170)', paddingBottom: 2 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  itemTitle: { fontFamily: 'Helvetica-Bold' },
  bullet: { flexDirection: 'row', marginTop: 2, paddingLeft: 8 },
  bulletDot: { width: 8, fontSize: 10 },
  bulletText: { flex: 1 },
});

export function createResumeDocument(resume: Resume) {
  return (
    <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.name}>{resume.contact.name}</Text>
        <Text style={styles.contact}>
          {[resume.contact.email, resume.contact.phone, resume.contact.location]
            .filter(Boolean)
            .join(' | ')}
        </Text>
      </View>

      {resume.summary && (
        <View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
          </View>
          <Text style={{ marginTop: 4 }}>{resume.summary}</Text>
        </View>
      )}

      {resume.experience && resume.experience.length > 0 && (
        <View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
          </View>
          {resume.experience.map((exp) => (
            <View key={exp.id} style={{ marginTop: 4 }}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>
                  {exp.title} — {exp.company}
                </Text>
                <Text>{[exp.start, exp.end].filter(Boolean).join(' - ')}</Text>
              </View>
              {exp.bullets.map((b) => (
                <View key={b.id} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{b.text}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {resume.projects && resume.projects.length > 0 && (
        <View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
          </View>
          {resume.projects.map((proj) => (
            <View key={proj.id} style={{ marginTop: 4 }}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>
                  {proj.name}
                  {proj.tech && proj.tech.length > 0 ? ` (${proj.tech.join(', ')})` : ''}
                </Text>
              </View>
              {proj.bullets.map((b) => (
                <View key={b.id} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{b.text}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {resume.skills && resume.skills.length > 0 && (
        <View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Technical Skills</Text>
          </View>
          <Text style={{ marginTop: 4 }}>{resume.skills.join(', ')}</Text>
        </View>
      )}

      {resume.education && resume.education.length > 0 && (
        <View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
          </View>
          {resume.education.map((edu) => (
            <View key={edu.id} style={styles.itemHeader}>
              <Text style={styles.itemTitle}>
                {edu.degree} — {edu.school}
              </Text>
              <Text>{edu.year || ''}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  </Document>
  );
}
