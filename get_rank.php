<?php
header("Content-Type: application/json");
include "db.php";

$name = $_GET['player_name'] ?? '';

if (!$name) {
    echo json_encode(["rank" => null]);
    exit;
}

// Get player's score
$stmt = $conn->prepare("SELECT high_score FROM players WHERE player_name = ?");
$stmt->bind_param("s", $name);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(["rank" => null]);
    exit;
}

$row = $result->fetch_assoc();
$score = $row['high_score'];

// Count how many players have higher score
$stmt2 = $conn->prepare("SELECT COUNT(*) AS higher FROM players WHERE high_score > ?");
$stmt2->bind_param("i", $score);
$stmt2->execute();
$res2 = $stmt2->get_result();
$row2 = $res2->fetch_assoc();

$rank = $row2['higher'] + 1;

echo json_encode(["rank" => $rank]);

$conn->close();
?>