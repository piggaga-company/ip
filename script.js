// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCCOqVJdEdPl4qIlj218L17DrkttHkJgF4",
    authDomain: "ipip-2356e.firebaseapp.com",
    projectId: "ipip-2356e",
    storageBucket: "ipip-2356e.appspot.com",
    messagingSenderId: "909013978451",
    appId: "1:909013978451:web:f4eb92d560688f8bf365a6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

window.onload = function() {
    getDeviceInfo();
    loadVisitedIPs();
    document.getElementById('clear-button').addEventListener('click', promptForPassword);
    document.getElementById('export-button').addEventListener('click', exportData);
    document.getElementById('search-ip').addEventListener('input', searchIP);
    document.getElementById('sort-by-visits').addEventListener('click', () => loadVisitedIPs('visits'));
    document.getElementById('sort-by-recent').addEventListener('click', () => loadVisitedIPs('recent'));
};

function getDeviceInfo() {
    fetch('https://api.ipify.org?format=json')
    .then(response => response.json())
    .then(data => {
        const ip = data.ip;
        document.getElementById('ip-address').textContent = ip;
        fetch(`https://ipapi.co/${ip}/json/`)
        .then(response => response.json())
        .then(data => {
            const { city, region, country_name } = data;
            document.getElementById('location').textContent = `${city}, ${region}, ${country_name}`;
        })
        .catch(error => console.error('Error fetching location:', error));
        
        const deviceInfo = {
            userAgent: navigator.userAgent,
            deviceType: getDeviceType()
        };
        document.getElementById('device-type').textContent = deviceInfo.deviceType;
        
        const additionalInfo = `User Agent: ${deviceInfo.userAgent}`;
        document.getElementById('additional-info').textContent = additionalInfo;

        const visitRecord = {
            ip: ip,
            visits: firebase.firestore.FieldValue.arrayUnion(new Date()),
            deviceType: deviceInfo.deviceType,
            userAgent: deviceInfo.userAgent
        };
        db.collection('visitedIPs').doc(ip).set(visitRecord, { merge: true });
    })
    .catch(error => console.error('Error fetching IP:', error));
}

function getDeviceType() {
    const userAgent = navigator.userAgent;
    if (/Mobile/.test(userAgent)) {
        return 'Mobile';
    } else if (/Tablet/.test(userAgent)) {
        return 'Tablet';
    } else {
        return 'Desktop';
    }
}

function loadVisitedIPs(sortBy = 'recent') {
    db.collection('visitedIPs').get().then((querySnapshot) => {
        const visitedIPs = {};
        querySnapshot.forEach((doc) => {
            visitedIPs[doc.id] = doc.data();
        });

        const visitedIPsList = document.getElementById('visited-ips-list');
        visitedIPsList.innerHTML = '';

        const ips = Object.keys(visitedIPs).sort((a, b) => {
            if (sortBy === 'visits') {
                return visitedIPs[b].visits.length - visitedIPs[a].visits.length;
            } else if (sortBy === 'recent') {
                return visitedIPs[b].visits[visitedIPs[b].visits.length - 1] - visitedIPs[a].visits[visitedIPs[a].visits.length - 1];
            }
        });

        for (const ip of ips) {
            const listItem = document.createElement('li');
            listItem.textContent = `${ip} (Visits: ${visitedIPs[ip].visits.length})`;
            listItem.addEventListener('click', () => showIPDetails(ip, visitedIPs[ip]));
            visitedIPsList.appendChild(listItem);
        }
    }).catch(error => console.error('Error loading IPs:', error));
}

function showIPDetails(ip, details) {
    document.getElementById('detail-ip').textContent = `IP Address: ${ip}`;
    document.getElementById('detail-visits').textContent = `Visits: ${details.visits.length}`;
    const timestampsList = document.getElementById('detail-timestamps');
    timestampsList.innerHTML = '';

    details.visits.forEach(timestamp => {
        const listItem = document.createElement('li');
        listItem.textContent = new Date(timestamp.toDate()).toLocaleString();
        timestampsList.appendChild(listItem);
    });

    const ctx = document.getElementById('visit-chart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: details.visits.map(timestamp => new Date(timestamp.toDate()).toLocaleString()),
            datasets: [{
                label: 'Visits',
                data: details.visits.map((_, index) => index + 1),
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                }
            }
        }
    });

    document.getElementById('ip-details').style.display = 'block';
}

function promptForPassword() {
    const password = prompt('Enter password to clear records:');
    if (password !== null && password === 'clearip') {
        promptForIP();
    } else {
        alert('Incorrect password.');
    }
}

function promptForIP() {
    const ipAddress = prompt('Enter the IP address you want to clear:');
    if (ipAddress !== null) {
        clearRecord(ipAddress);
    }
}

function clearRecord(ipAddress) {
    db.collection('visitedIPs').doc(ipAddress).delete().then(() => {
        loadVisitedIPs();
        document.getElementById('ip-details').style.display = 'none';
        alert('Record cleared successfully.');
    }).catch(error => console.error('Error clearing record:', error));
}

function searchIP() {
    const searchQuery = document.getElementById('search-ip').value;
    db.collection('visitedIPs').get().then((querySnapshot) => {
        const visitedIPs = {};
        querySnapshot.forEach((doc) => {
            visitedIPs[doc.id] = doc.data();
        });

        const visitedIPsList = document.getElementById('visited-ips-list');
        visitedIPsList.innerHTML = '';

        for (const ip in visitedIPs) {
            if (ip.includes(searchQuery)) {
                const listItem = document.createElement('li');
                listItem.textContent = `${ip} (Visits: ${visitedIPs[ip].visits.length})`;
                listItem.addEventListener('click', () => showIPDetails(ip, visitedIPs[ip]));
                visitedIPsList.appendChild(listItem);
            }
        }
    }).catch(error => console.error('Error searching IP:', error));
}

function exportData() {
    db.collection('visitedIPs').get().then((querySnapshot) => {
        let csvContent = "data:text/csv;charset=utf-8,IP Address,Visits,Device Type,User Agent,Timestamps\n";

        querySnapshot.forEach((doc) => {
            const details = doc.data();
            const timestamps = details.visits.map(ts => new Date(ts.toDate()).toLocaleString()).join('; ');
            csvContent += `${doc.id},${details.visits.length},${details.deviceType},${details.userAgent},"${timestamps}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'visited_ips.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(error => console.error('Error exporting data:', error));
}
