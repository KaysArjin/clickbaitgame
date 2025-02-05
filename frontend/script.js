const socket = io("http://localhost:3000");
let playerName = "";

document.getElementById("joinGame").addEventListener("click", function() {
    playerName = document.getElementById("playerName").value.trim();
    if (playerName === "") return alert("Please enter a name!");

    socket.emit("joinGame", playerName);

    document.getElementById("setup").style.display = "none";
    document.getElementById("gameArea").style.display = "block";
    document.getElementById("linkSubmission").style.display = "block";
});

document.getElementById("submitLink").addEventListener("click", function() {
    const link = document.getElementById("wikiLink").value.trim();
    if (link === "" || !link.includes("wikipedia.org")) return alert("Enter a valid Wikipedia link!");

    console.log(`Submitting link: ${link}`);

    socket.emit("submitLink", { playerName, link });

    document.getElementById("linkSubmission").style.display = "none";
});

socket.on("updatePlayers", ({ players, scores, currentJudge }) => {
    document.getElementById("playerList").innerHTML = players.map(
        player => `<li>${player} - ${scores[player]} points</li>`
    ).join("");

    document.getElementById("judgeDisplay").textContent = `Judge: ${currentJudge}`;
});


socket.on("linksSubmitted", ({ count }) => {
    document.getElementById("gameStatus").textContent = `Links submitted: ${count}`;
});


socket.on("showLink", ({ link }) => {

    console.log(`Judge received link: ${link}`);

    document.getElementById("randomLink").href = link;
    document.getElementById("judgeView").style.display = "block";
});
