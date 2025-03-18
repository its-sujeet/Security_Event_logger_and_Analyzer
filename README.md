

# OS Security Log Dashboard

This project provides a dashboard for displaying OS security logs in real-time, with visualizations and filtering options for the logs based on severity and category. The frontend of this project uses React, and the backend utilizes WebSocket communication (Socket.io) to stream the logs to the dashboard.

## Features:
- Real-time log updates via WebSockets.
- Logs can be filtered by severity (Critical, Warning, Normal).
- Log data is visualized using charts.
- Modern and interactive user interface built with React and Material UI.

## Prerequisites:
Ensure you have the following installed:
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Backend server running** (Socket.io) - You'll need to connect this frontend to a live backend or run your own backend server for real-time log updates.

## Installation & Setup

### 1. Clone the repository

Clone this repository to your local machine:

```bash
git clone https://github.com/its-sujeet/os_project.git
```

### 2. Navigate to the dashboard directory

Move into the project folder:

```bash
cd os-security-log-dashboard/security-dashboard/dashboard
```

### 3. Install dependencies

Run the following command to install the required dependencies:

```bash
npm install
```

or, if you're using yarn:

```bash
yarn install
```

Install the required frontend packages:

```bash
npm install @mui/material react-chartjs-2 chart.js socket.io-client
```

### 4. Start the development server

Run the following command to start the React development server:

```bash
npm run dev
```

This will start the frontend application, which will be available at `http://localhost:5173`.

### 5. Verify the setup

- Ensure your backend (Socket.io) server is running and accessible.
- The frontend should automatically connect to the backend, and you should start seeing real-time log updates.
- You should be able to filter logs by severity and category.
- Charts should appear when the "Show Charts" button is clicked.

## Folder Structure

```
security-dashboard/
│
├── dashboard/             # Frontend application
│   ├── dist/              # Build files (after production build)
│   ├── node_modules/      # Installed dependencies
│   ├── public/            # Static files (images, index.html)
│   ├── src/               # Source code for React components
│   ├── .gitignore         # Git ignore rules
│   ├── eslint.config.js   # ESLint configuration
│   ├── index.html         # Main HTML file for the app
│   ├── package-lock.json  # npm lock file
│   ├── package.json       # Project metadata and dependencies
│   ├── README.md          # This file
│   └── vite.config.js     # Vite configuration for the build tool
```

---

### 6. Navigate to the backend directory

Move into the backend folder:

```bash
cd os-security-log-dashboard
```

### 7. Install backend dependencies

Make sure you have Flask, Flask-SocketIO, pywin32, and other dependencies installed. You can install them by running:

```bash
pip install -r requirements.txt
```

Where `requirements.txt` should contain:

```
Flask==2.2.2
Flask-SocketIO==5.3.0
pywin32==303
sqlite3==2.6.0
flask_cors==3.1.1
```

### 8. Run the backend

Run the following command to start the backend server:

```bash
python realtime_logs.py
```

The backend will start and listen on `http://localhost:5000`. It will collect Windows Event Logs in real-time and stream them to the frontend via WebSocket.

---

## Troubleshooting

- **Frontend not connecting to the backend**:
  - Ensure the backend is running and accessible at the expected URL (check WebSocket server URL).
  - Open the browser’s console (F12) and look for any errors related to WebSocket or the connection.
  
- **Backend not emitting logs**:
  - Make sure the backend server is emitting the correct `log_update` event. Test this by sending mock data or connecting a client to the backend.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Material UI](https://mui.com/) - for the UI components
- [React](https://reactjs.org/) - JavaScript library for building the user interface
- [Socket.io](https://socket.io/) - for real-time communication between frontend and backend
- [Chart.js](https://www.chartjs.org/) - for creating charts
- [Vite](https://vitejs.dev/) - for fast frontend development

---

