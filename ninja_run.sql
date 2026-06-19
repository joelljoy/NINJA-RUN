CREATE DATABASE ninja_run;
USE ninja_run;

CREATE TABLE players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_name VARCHAR(50) UNIQUE,
    high_score INT DEFAULT 0,
    coins_collected INT DEFAULT 0,
    last_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
                 ON UPDATE CURRENT_TIMESTAMP
);

