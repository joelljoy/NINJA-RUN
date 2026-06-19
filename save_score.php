<?php
header("Content-Type: application/json");
include "db.php";

$name = $_POST['player_name'] ?? '';
$score = intval($_POST['high_score'] ?? 0);
$coins = intval($_POST['coins_collected'] ?? 0);

if (!$name) {
    echo json_encode(["status" => "error", "msg" => "No name"]);
    exit;
}

$sql = "INSERT INTO players (player_name, high_score, coins_collected)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
  high_score = IF(VALUES(high_score) > high_score, VALUES(high_score), high_score),
  coins_collected = IF(VALUES(high_score) > high_score, VALUES(coins_collected), coins_collected)";

$stmt = $conn->prepare($sql);
$stmt->bind_param("sii", $name, $score, $coins);
$stmt->execute();

echo json_encode(["status" => "success"]);

$stmt->close();
$conn->close();
?>