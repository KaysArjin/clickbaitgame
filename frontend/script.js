document.getElementById("joinGame").addEventListener("click", function() {
    const playerName = document.getElementById("playerName").value.trim();

    if (playerName === "") {
        alert("Please enter a name!");
        return;
    }

    // Hide setup, show game area
    document.getElementById("setup").style.display = "none";
    document.getElementById("gameArea").style.display = "block";

    document.getElementById("gameStatus").textContent = `${playerName} has joined the game!`;
});
