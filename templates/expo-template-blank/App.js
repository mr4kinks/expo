import React, { useEffect, useRef, useState } from "react";
import { View, Text, Button, TextInput, Alert } from "react-native";
import { ScrollView, Dimensions } from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const APP_ID = "CR8924539";
const BASE_WS = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

export default function DerivDigitAnalyzerApp() {
  const ws = useRef(null);
  const [digit, setDigit] = useState("5");
  const [matchCount, setMatchCount] = useState(0);
  const [differCount, setDifferCount] = useState(0);
  const [tickHistory, setTickHistory] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("R_100");
  const [connected, setConnected] = useState(false);
  const [matchStreak, setMatchStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  useEffect(() => {
    ws.current = new WebSocket(BASE_WS);

    ws.current.onopen = () => {
      setConnected(true);
      ws.current.send(
        JSON.stringify({
          ticks: selectedSymbol,
          subscribe: 1,
        })
      );
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.msg_type === "tick") {
        const lastDigit = data.tick.quote.toString().slice(-1);
        const isMatch = lastDigit === digit;

        setMatchCount((prev) => prev + (isMatch ? 1 : 0));
        setDifferCount((prev) => prev + (!isMatch ? 1 : 0));
        setTickHistory((prev) => [
          ...prev.slice(-49),
          { time: new Date().toLocaleTimeString(), digit: lastDigit, isMatch },
        ]);

        setMatchStreak((prev) => {
          const newStreak = isMatch ? prev + 1 : 0;
          if (newStreak > maxStreak) setMaxStreak(newStreak);
          if (newStreak === 3) {
            Alert.alert("🔥 Match Streak!", `3 Matches in a Row with Digit ${digit}`);
          }
          return newStreak;
        });
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [digit, selectedSymbol]);

  const resetCounts = () => {
    setMatchCount(0);
    setDifferCount(0);
    setTickHistory([]);
    setMatchStreak(0);
    setMaxStreak(0);
  };

  const exportCSV = async () => {
    const csvContent = [
      "Time,Digit,Result",
      ...tickHistory.map((tick) => `${tick.time},${tick.digit},${tick.isMatch ? "Match" : "Differ"}`)
    ].join("\n");

    const fileUri = FileSystem.documentDirectory + "tick_history.csv";
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

    Sharing.shareAsync(fileUri);
  };

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>
        Deriv Matches & Differs Analyzer
      </Text>

      <Text>Enter Digit (0-9):</Text>
      <TextInput
        value={digit}
        onChangeText={(val) => setDigit(val)}
        maxLength={1}
        keyboardType="numeric"
        style={{ borderBottomWidth: 1, marginBottom: 10 }}
      />

      <Text>Symbol:</Text>
      <TextInput
        value={selectedSymbol}
        onChangeText={(val) => setSelectedSymbol(val)}
        style={{ borderBottomWidth: 1, marginBottom: 10 }}
      />

      <Button title="Reset Stats" onPress={resetCounts} />
      <Button title="Export to CSV" onPress={exportCSV} />

      <View style={{ marginVertical: 20 }}>
        <Text>Matches: {matchCount}</Text>
        <Text>Differs: {differCount}</Text>
        <Text>Current Match Streak: {matchStreak}</Text>
        <Text>Max Match Streak: {maxStreak}</Text>
      </View>

      <Text style={{ fontWeight: "bold", marginBottom: 10 }}>Match vs Differ Chart:</Text>
      <BarChart
        data={{
          labels: ["Match", "Differ"],
          datasets: [{ data: [matchCount, differCount] }],
        }}
        width={Dimensions.get("window").width - 32}
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        style={{ marginBottom: 16 }}
      />

      <Text style={{ fontWeight: "bold", marginBottom: 10 }}>Digit Trend (Last 50):</Text>
      <LineChart
        data={{
          labels: tickHistory.map((tick, index) => (index % 10 === 0 ? tick.time : "")),
          datasets: [
            {
              data: tickHistory.map((tick) => parseInt(tick.digit)),
              strokeWidth: 2,
            },
          ],
        }}
        width={Dimensions.get("window").width - 32}
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        style={{ marginBottom: 16 }}
      />

      <Text style={{ fontWeight: "bold" }}>Last 50 Ticks:</Text>
      {tickHistory.map((tick, index) => (
        <Text key={index}>
          {tick.time} - Digit: {tick.digit} ({tick.isMatch ? "Match" : "Differ"})
        </Text>
      ))}
    </ScrollView>
  );
}
