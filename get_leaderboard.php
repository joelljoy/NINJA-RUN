<?php
header("Content-Type: application/json");
include "db.php";

$sql = "SELECT player_name, high_score, coins_collected 
        FROM players 
        ORDER BY high_score DESC 
        LIMIT 5";

$result = $conn->query($sql);

$data = [];

while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);

$conn->close();
?>