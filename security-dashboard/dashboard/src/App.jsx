import React, { useEffect, useState, useRef } from 'react';
import {
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Chip,
  TableContainer,
  TextField,
  Button,
  Box,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { io } from 'socket.io-client';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import AnalyzeIcon from '@mui/icons-material/Assessment';
import axios from 'axios';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend, ArcElement);

const socket = io('http://localhost:5000', { reconnection: true });

const App = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortColumn, setSortColumn] = useState('time_generated');
  const [sortDirection, setSortDirection] = useState('desc');
  const [connected, setConnected] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [error, setError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(1);
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [openChatDialog, setOpenChatDialog] = useState(false);
  const [selectedEventLogs, setSelectedEventLogs] = useState([]);
  const logsPerPage = 100;
  const severityChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      setError(null);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });
    socket.on('log_update', (newLogs) => {
      console.log('Received log update:', newLogs);
      setLogs((prevLogs) => {
        const existingIds = new Set(prevLogs.map((log) => `${log.record_id}`));
        const uniqueNewLogs = newLogs.filter(
          (newLog) => !existingIds.has(`${newLog.record_id}`)
        );
        const updatedLogs = [...uniqueNewLogs, ...prevLogs].sort(
          (a, b) => new Date(b.time_generated) - new Date(a.time_generated)
        );
        return updatedLogs;
      });
      setLoading(false);
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to log server');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('log_update');
      socket.off('connect_error');
    };
  }, []);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatMessages, isSending]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'a' && expandedLogId) {
        const expandedLog = logs.find((log) => `${log.record_id}` === expandedLogId);
        if (expandedLog) {
          setSelectedLog(expandedLog);
          setOpenChatDialog(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedLogId, logs]);

  const mergedLogs = () => {
    const logMap = new Map();
    logs.forEach((log) => {
      const eventId = log.event_id;
      if (logMap.has(eventId)) {
        logMap.get(eventId).push(log);
      } else {
        logMap.set(eventId, [log]);
      }
    });
    return Array.from(logMap.entries()).map(([eventId, eventLogs]) => ({
      event_id: eventId,
      count: eventLogs.length,
      logs: eventLogs,
      latest: eventLogs.reduce((latest, current) =>
        new Date(current.time_generated) > new Date(latest.time_generated) ? current : latest
      ),
    }));
  };

  const filteredLogs = mergedLogs().filter(
    (mergedLog) =>
      (filterSeverity === 'All' || mergedLog.latest.severity === filterSeverity) &&
      (filterCategory === 'All' || mergedLog.latest.category === filterCategory)
  );

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const compare = (a, b, column) => {
      if (column === 'time_generated') {
        return new Date(a.latest.time_generated) - new Date(b.latest.time_generated);
      } else if (column === 'event_id') {
        return a.event_id - b.event_id;
      } else if (typeof a.latest[column] === 'string') {
        return a.latest[column].localeCompare(b.latest[column]);
      } else {
        return a.latest[column] - b.latest[column];
      }
    };
    return sortDirection === 'asc' ? compare(a, b, sortColumn) : compare(b, a, sortColumn);
  });

  const totalPages = Math.ceil(sortedLogs.length / logsPerPage);
  const paginatedLogs = sortedLogs.slice((page - 1) * logsPerPage, page * logsPerPage);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleRowClick = (eventId) => {
    const mergedLog = sortedLogs.find((log) => log.event_id === eventId);
    if (mergedLog.count > 1) {
      setSelectedEventLogs(mergedLog.logs);
      setOpenEventDialog(true);
    } else {
      const logId = `${mergedLog.logs[0].record_id}`;
      // Toggle expansion: expand if not expanded, collapse if already expanded
      setExpandedLogId(expandedLogId === logId ? null : logId);
      setSelectedLog(mergedLog.logs[0]);
    }
  };

  const handleAnalyzeClick = (log, event) => {
    event.stopPropagation(); // Prevent row click from triggering
    setSelectedLog(log);
    setOpenChatDialog(true);
  };

  const handleEventDialogClose = () => {
    setOpenEventDialog(false);
    setSelectedEventLogs([]);
  };

  const handleChatDialogClose = () => {
    setOpenChatDialog(false);
    setChatMessages([]);
  };

  const handleLogSelect = (log) => {
    const logId = `${log.record_id}`;
    setExpandedLogId(logId); // Expand the selected log
    setSelectedLog(log);
    setOpenEventDialog(false);
  };

  const getRowStyle = (severity, isExpanded) => {
    const baseStyle = {
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      height: isExpanded ? 'auto' : '60px',
      minHeight: isExpanded ? '100px' : '60px',
    };
    switch (severity) {
      case 'Critical':
        return { ...baseStyle, background: '#FF4C4C', color: '#1a1a1a', boxShadow: '0 4px 10px rgba(255, 76, 76, 0.5)', fontWeight: 'bold' };
      case 'Warning':
        return { ...baseStyle, background: 'rgba(255, 76, 76, 0.5)', color: '#fff', boxShadow: '0 4px 10px rgba(255, 76, 76, 0.2)' };
      case 'Normal':
        return { ...baseStyle, background: 'rgba(255, 76, 76, 0.1)', color: '#fff' };
      default:
        return { ...baseStyle, background: '#2d2d2d', color: '#fff' };
    }
  };

  const getSeverityData = () => ({
    labels: ['Critical', 'Warning', 'Normal'],
    datasets: [{
      data: [
        logs.filter((l) => l.severity === 'Critical').length,
        logs.filter((l) => l.severity === 'Warning').length,
        logs.filter((l) => l.severity === 'Normal').length,
      ],
      backgroundColor: ['#FF4C4C', 'rgba(255, 76, 76, 0.5)', 'rgba(255, 76, 76, 0.2)'],
      borderWidth: 0,
    }],
  });

  const allCategories = [
    'Application',
    'Security',
    'System',
    'Microsoft-Windows-PowerShell/Operational',
    'Microsoft-Windows-TaskScheduler/Operational',
    'Microsoft-Windows-WindowsUpdateClient/Operational',
    'Microsoft-Windows-WMI-Activity/Operational',
  ];

  const getCategoryData = () => ({
    labels: allCategories,
    datasets: [{
      data: allCategories.map((cat) => logs.filter((l) => l.category === cat).length),
      backgroundColor: [
        '#FF4C4C',
        'rgba(255, 76, 76, 0.8)',
        'rgba(255, 76, 76, 0.6)',
        'rgba(255, 76, 76, 0.4)',
        'rgba(255, 76, 76, 0.3)',
        'rgba(255, 76, 76, 0.2)',
        'rgba(255, 76, 76, 0.1)',
      ],
      borderWidth: 0,
    }],
  });

  const getTimeTrendData = () => {
    const timeSeries = {};
    logs.forEach((log) => {
      const date = new Date(log.time_generated).toLocaleDateString();
      timeSeries[date] = (timeSeries[date] || 0) + 1;
    });

    const sortedDates = Object.keys(timeSeries).sort((a, b) => new Date(a) - new Date(b));
    const sortedCounts = sortedDates.map((date) => timeSeries[date]);

    return {
      labels: sortedDates,
      datasets: [{
        label: 'Logs per Day',
        data: sortedCounts,
        backgroundColor: 'rgba(255, 76, 76, 0.7)',
        borderColor: '#FF4C4C',
        borderWidth: 2,
      }],
    };
  };

  const truncateText = (text, maxLength = 20) => {
    if (!text) return 'N/A';
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  const sanitizeText = (text) => {
    return text
      .replace(/â/g, '"')
      .replace(/â/g, '"')
      .replace(/â/g, "'")
      .replace(/[^\x00-\x7F]/g, '');
  };

  const formatAiResponse = (text) => {
    return text
      .replace(/^# (.*)$/gm, '<h1 style="font-size: 1.2rem; font-weight: bold; color: #FF4C4C; margin: 10px 0 5px 0; text-align: left;">$1</h1>')
      .replace(/^## (.*)$/gm, '<h2 style="font-size: 1rem; font-weight: bold; color: #FF8C8C; margin: 8px 0 4px 0; text-align: left;">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  const handleChatSubmit = async () => {
    if (!chatInput || !selectedLog) return;

    setChatMessages((prev) => [
      ...prev,
      { user: chatInput, event_id: selectedLog.event_id },
    ]);
    setIsSending(true);

    try {
      const prevMessages = chatMessages
        .filter((msg) => msg.event_id === selectedLog.event_id)
        .map((msg) => ({
          role: msg.user ? 'user' : 'assistant',
          content: msg.user || msg.ai,
        }));

      const response = await axios.post(
        'http://127.0.0.1:5143/api/chat',
        {
          input_text: chatInput,
          params: { api_model: 'gemini-2.0-flash', event_details: selectedLog },
          prev_messages: prevMessages.map((msg) => JSON.stringify(msg)),
        },
        { timeout: 15000, responseEncoding: 'utf8' }
      );

      const responseData = response.data;
      if (responseData.response) {
        const sanitizedResponse = sanitizeText(responseData.response);
        setChatMessages((prev) => [
          ...prev.slice(0, -1),
          {
            user: chatInput,
            ai: sanitizedResponse,
            event_id: selectedLog.event_id,
          },
        ]);
        setError(null);
      } else {
        setError(responseData.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat API error:', error);
      setError(`Failed to get AI response: ${error.message}`);
    } finally {
      setIsSending(false);
      setChatInput('');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      background: '#1a1a1a',
      overflow: 'hidden',
    }}>
      {/* Top Section: Charts */}
      <div style={{
        height: '35vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        padding: '1vh',
        background: '#2d2d2d',
        gap: '1vw',
        overflowX: 'auto',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '20vw' }}>
          <Typography variant="h6" style={{ color: '#FF4C4C', textAlign: 'center', fontSize: '1rem' }}>
            Severity Distribution
          </Typography>
          <div style={{ flex: 1 }}>
            <Pie ref={severityChartRef} data={getSeverityData()} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#FF4C4C', font: { size: 12 } } } },
              onClick: (event) => {
                const chart = severityChartRef.current;
                const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
                if (elements.length > 0) {
                  const index = elements[0].index;
                  const severity = ['Critical', 'Warning', 'Normal'][index];
                  setFilterSeverity(severity);
                  setPage(1);
                }
              },
            }} />
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '20vw' }}>
          <Typography variant="h6" style={{ color: '#FF4C4C', textAlign: 'center', fontSize: '1rem' }}>
            Category Distribution
          </Typography>
          <div style={{ flex: 1 }}>
            <Pie ref={categoryChartRef} data={getCategoryData()} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#FF4C4C', font: { size: 12 } } } },
              onClick: (event) => {
                const chart = categoryChartRef.current;
                const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
                if (elements.length > 0) {
                  const index = elements[0].index;
                  const category = allCategories[index];
                  setFilterCategory(category);
                  setPage(1);
                }
              },
            }} />
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '20vw' }}>
          <Typography variant="h6" style={{ color: '#FF4C4C', textAlign: 'center', fontSize: '1rem' }}>
            Log Trend Over Time
          </Typography>
          <div style={{ 
            flex: 1, 
            overflowX: 'auto', 
            overflowY: 'hidden',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ width: `${getTimeTrendData().labels.length * 50}px`, minWidth: '100%' }}>
              <Bar data={getTimeTrendData()} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                  legend: { labels: { color: '#FF4C4C', font: { size: 12 } } },
                },
                scales: {
                  x: { 
                    ticks: { 
                      color: '#FF4C4C', 
                      autoSkip: false, // Show all labels
                      maxRotation: 45, 
                      minRotation: 45, 
                      font: { size: 10 } 
                    },
                    barPercentage: 0.8,
                    categoryPercentage: 0.9,
                  },
                  y: { 
                    ticks: { color: '#FF4C4C', font: { size: 10 } },
                    beginAtZero: true,
                  },
                },
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Logs */}
      <div style={{
        flex: 1,
        width: '100%',
        padding: '2vh 1vw',
        background: '#1a1a1a',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Typography variant="h4" style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '1vh', fontSize: '1.5rem' }}>
          OS Security Logs
        </Typography>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1vh', flexWrap: 'wrap', gap: '0.5vw' }}>
          <Typography variant="h6" style={{ color: '#FF4C4C', marginRight: '0.5vw', fontSize: '1rem' }}>
            Category:
          </Typography>
          {['All', ...allCategories].map((cat) => (
            <Chip
              key={cat}
              label={cat.split('/')[0]}
              onClick={() => { setFilterCategory(cat); setPage(1); }}
              color={cat === filterCategory ? 'primary' : 'default'}
              style={{ margin: '0 0.25vw', color: '#fff', backgroundColor: cat === filterCategory ? '#1976d2' : '#424242', fontSize: '0.8rem' }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1vh', flexWrap: 'wrap', gap: '0.5vw' }}>
          <Typography variant="h6" style={{ color: '#FF4C4C', marginRight: '0.5vw', fontSize: '1rem' }}>
            Severity:
          </Typography>
          {['All', 'Critical', 'Warning', 'Normal'].map((sev) => (
            <Chip
              key={sev}
              label={sev}
              onClick={() => { setFilterSeverity(sev); setPage(1); }}
              color={sev === filterSeverity ? 'primary' : 'default'}
              style={{ margin: '0 0.25vw', color: '#fff', backgroundColor: sev === filterSeverity ? '#1976d2' : '#424242', fontSize: '0.8rem' }}
            />
          ))}
        </div>
        {error && <Typography style={{ color: '#FF4C4C', textAlign: 'center', fontSize: '1rem' }}>{error}</Typography>}
        {!connected && !error && (
          <Typography style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '1vh', fontSize: '1rem' }}>
            Connecting to log server...
          </Typography>
        )}
        {loading ? (
          <CircularProgress style={{ color: '#FF4C4C', margin: 'auto', display: 'block' }} />
        ) : (
          <>
            <TableContainer style={{ 
              flex: 1, 
              maxHeight: 'calc(65vh - 100px)', 
              background: '#2d2d2d', 
              overflowY: 'auto', 
              overflowX: 'hidden',
            }}>
              <Table stickyHeader style={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    {[
                      { id: 'event_id', label: 'Event ID', width: '7%' },
                      { id: 'category', label: 'Category', width: '15%' },
                      { id: 'source', label: 'Source', width: '15%' },
                      { id: 'time_generated', label: 'Time Generated', width: '11%' },
                      { id: 'severity', label: 'Severity', width: '5%' },
                      { id: 'message', label: 'Message', width: '10%' },
                      { id: 'action', label: 'Action', width: '5%' },
                    ].map((column) => (
                      <TableCell
                        key={column.id}
                        onClick={column.id !== 'action' ? () => handleSort(column.id) : undefined}
                        style={{
                          cursor: column.id !== 'action' ? 'pointer' : 'default',
                          fontWeight: 'bold',
                          color: '#1a1a1a',
                          background: '#FF4C4C',
                          fontSize: '0.9rem',
                          width: column.width,
                          minWidth: column.id === 'action' ? '80px' : undefined,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          padding: '0.5vw',
                        }}
                      >
                        {column.label} {sortColumn === column.id && column.id !== 'action' && (sortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} style={{ color: '#fff', textAlign: 'center', fontSize: '1rem' }}>
                        No logs available
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLogs.map((mergedLog, index) => {
                      const logId = `${mergedLog.latest.record_id}`;
                      const isExpanded = expandedLogId === logId;
                      return (
                        <TableRow
                          key={index}
                          style={getRowStyle(mergedLog.latest.severity, isExpanded)}
                          onClick={() => handleRowClick(mergedLog.event_id)}
                          onMouseOver={(e) => { if (!isExpanded) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(255, 76, 76, 0.5)'; } }}
                          onMouseOut={(e) => { if (!isExpanded) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
                        >
                          <TableCell style={{ fontSize: '0.8rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: isExpanded ? '1vw' : '0.5vw' }}>
                            {mergedLog.count > 1 ? `${mergedLog.event_id} (Count:${mergedLog.count})` : mergedLog.event_id}
                          </TableCell>
                          <TableCell style={{ fontSize: '0.8rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: isExpanded ? '1vw' : '0.5vw' }}>{mergedLog.latest.category}</TableCell>
                          <TableCell style={{ fontSize: '0.8rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: isExpanded ? '1vw' : '0.5vw' }}>{mergedLog.latest.source}</TableCell>
                          <TableCell style={{ fontSize: '0.8rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: isExpanded ? '1vw' : '0.5vw' }}>{mergedLog.latest.time_generated}</TableCell>
                          <TableCell style={{ fontSize: '0.8rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: isExpanded ? '1vw' : '0.5vw' }}>{mergedLog.latest.severity}</TableCell>
                          <TableCell style={{ fontSize: '0.8rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: isExpanded ? 'break-word' : 'normal', padding: isExpanded ? '1vw' : '0.5vw' }}>
                            {isExpanded ? (mergedLog.latest.message || 'N/A') : truncateText(mergedLog.latest.message)}
                          </TableCell>
                          <TableCell style={{ padding: isExpanded ? '1vw' : '0.5vw', minWidth: '80px' }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AnalyzeIcon />}
                              onClick={(e) => handleAnalyzeClick(mergedLog.latest, e)}
                              style={{ 
                                color: '#1976D2', 
                                borderColor: '#1976D2', 
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                minWidth: '70px',
                              }}
                            >
                              Analyze
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', justifyContent: 'center', padding: '1vh 0' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                sx={{
                  '& .MuiPaginationItem-root': { color: '#FF4C4C', fontSize: '0.9rem' },
                  '& .Mui-selected': { backgroundColor: '#FF4C4C', color: '#fff' },
                }}
              />
            </Box>
          </>
        )}
      </div>

      {/* Event Dialog */}
      <Dialog open={openEventDialog} onClose={handleEventDialogClose} maxWidth="lg" fullWidth>
        <DialogTitle style={{ background: '#2d2d2d', color: '#FF4C4C', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1vh 1vw' }}>
          Event ID: {selectedEventLogs.length > 0 ? selectedEventLogs[0].event_id : ''} (Occurrences: {selectedEventLogs.length})
          <IconButton onClick={handleEventDialogClose} style={{ color: '#FF4C4C' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent style={{ background: '#1a1a1a', color: '#fff', padding: '1vh 1vw', overflowX: 'hidden' }}>
          <TableContainer style={{ overflowX: 'hidden' }}>
            <Table style={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow>
                  {[
                    { id: 'record_id', label: 'Record ID', width: '15%' },
                    { id: 'time_generated', label: 'Time Generated', width: '25%' },
                    { id: 'source', label: 'Source', width: '25%' },
                    { id: 'message', label: 'Message', width: '25%' },
                    { id: 'action', label: 'Action', width: '10%' },
                  ].map((column) => (
                    <TableCell
                      key={column.id}
                      style={{
                        color: '#FF4C4C',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        width: column.width,
                        minWidth: column.id === 'action' ? '80px' : undefined,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        padding: '0.5vw',
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedEventLogs.map((log, index) => (
                  <TableRow key={index} style={{ background: index % 2 === 0 ? '#2d2d2d' : '#1a1a1a' }}>
                    <TableCell style={{ color: '#fff', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0.5vw' }}>{log.record_id}</TableCell>
                    <TableCell style={{ color: '#fff', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0.5vw' }}>{log.time_generated}</TableCell>
                    <TableCell style={{ color: '#fff', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0.5vw' }}>{log.source}</TableCell>
                    <TableCell style={{ color: '#fff', fontSize: '0.8rem', whiteSpace: 'normal', wordBreak: 'break-word', padding: '0.5vw' }}>{log.message || 'N/A'}</TableCell>
                    <TableCell style={{ padding: '0.5vw', minWidth: '80px' }}>
                      <Button
                        variant="outlined"
                        onClick={() => handleLogSelect(log)}
                        style={{ 
                          color: '#FF4C4C', 
                          borderColor: '#FF4C4C', 
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          minWidth: '70px',
                        }}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions style={{ background: '#2d2d2d', padding: '1vh 1vw' }}>
          <Button onClick={handleEventDialogClose} style={{ color: '#FF4C4C', fontSize: '0.8rem' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog open={openChatDialog} onClose={handleChatDialogClose} maxWidth="md" fullWidth>
        <DialogTitle style={{ background: '#2d2d2d', color: '#FF4C4C', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1vh 1vw' }}>
          AI Analyzer {selectedLog ? `(Event ID: ${selectedLog.event_id})` : ''}
          <IconButton onClick={handleChatDialogClose} style={{ color: '#FF4C4C' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent style={{ background: 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)', padding: '2vh 2vw', height: '60vh', display: 'flex', flexDirection: 'column' }}>
          <Box
            ref={chatBoxRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1vh 1vw',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '10px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#FF4C4C #2d2d2d',
            }}
          >
            {chatMessages.length === 0 && !isSending ? (
              <Typography style={{ color: '#888', textAlign: 'center', fontStyle: 'italic', fontSize: '0.9rem' }}>
                Start the conversation...
              </Typography>
            ) : (
              <>
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className="message-container" style={{ marginBottom: '1vh' }}>
                    {msg.user && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5vh' }}>
                        <div style={{
                          maxWidth: '70%',
                          background: 'linear-gradient(135deg, #FF4C4C, #FF8C8C)',
                          color: '#fff',
                          padding: '0.5vh 1vw',
                          borderRadius: '15px',
                          boxShadow: '0 4px 15px rgba(255, 76, 76, 0.4)',
                          animation: 'fadeIn 0.3s ease-in',
                          textAlign: 'left',
                        }}>
                          <Typography style={{ fontSize: '0.8rem', fontWeight: '500' }}>{msg.user}</Typography>
                        </div>
                      </div>
                    )}
                    {msg.ai && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.5vh' }}>
                        <div style={{
                          maxWidth: '90%',
                          background: 'linear-gradient(135deg, #2d2d2d, #4a4a4a)',
                          color: '#FF4C4C',
                          padding: '1vh 1vw',
                          borderRadius: '15px',
                          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                          animation: 'fadeIn 0.3s ease-in',
                          whiteSpace: 'pre-wrap',
                          textAlign: 'left',
                        }}>
                          <Typography
                            style={{ fontSize: '0.8rem', fontWeight: '400', color: '#fff', textAlign: 'left' }}
                            component="div"
                            dangerouslySetInnerHTML={{ __html: formatAiResponse(msg.ai) }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.5vh' }}>
                    <div style={{
                      maxWidth: '90%',
                      background: 'linear-gradient(135deg, #2d2d2d, #4a4a4a)',
                      color: '#FF4C4C',
                      padding: '0.5vh 1vw',
                      borderRadius: '15px',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
                      animation: 'fadeIn 0.3s ease-in',
                      textAlign: 'left',
                    }}>
                      <Typography style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                        <span className="loading-dots">...</span>
                      </Typography>
                    </div>
                  </div>
                )}
              </>
            )}
          </Box>
          <div style={{ display: 'flex', gap: '1vw', marginTop: '1vh', alignItems: 'center' }}>
            <TextField
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              fullWidth
              disabled={!selectedLog || isSending}
              style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '25px', padding: '0.5vh 1vw' }}
              InputProps={{ style: { color: '#fff', fontSize: '0.8rem' }, disableUnderline: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: '#FF4C4C' },
                  '&.Mui-focused fieldset': { borderColor: '#242424' },
                },
              }}
              onKeyPress={(e) => e.key === 'Enter' && !isSending && handleChatSubmit()}
            />
            <Button
              variant="contained"
              onClick={handleChatSubmit}
              disabled={!selectedLog || !chatInput || isSending}
              style={{
                background: 'linear-gradient(135deg, #FF4C4C, #FF8C8C)',
                color: '#fff',
                borderRadius: '25px',
                padding: '0.5vh 2vw',
                boxShadow: '0 4px 15px rgba(255, 76, 76, 0.4)',
                fontSize: '0.8rem',
              }}
              sx={{
                '&:hover': { transform: 'scale(1.05)', boxShadow: '0 6px 20px rgba(255, 76, 76, 0.6)' },
                '&:disabled': { background: '#666', boxShadow: 'none' },
              }}
            >
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default App;