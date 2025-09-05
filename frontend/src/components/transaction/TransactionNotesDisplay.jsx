/**
 * Transaction Notes Display Component
 * 
 * Simplified notes display with add/delete functionality.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { FileText, Clock, User, Plus, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import authService from '../../services/authService';

/**
 * Component for displaying and managing transaction notes
 */
export default function TransactionNotesDisplay({ transaction, onNotesUpdate }) {
  const [noteEntries, setNoteEntries] = useState([]);
  const [rawNotes, setRawNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [deletingNote, setDeletingNote] = useState(null);

  /**
   * Parse notes into individual entries with IDs
   */
  const parseNotesToEntries = (notesText) => {
    if (!notesText) return [];
    
    const lines = notesText.split('\n');
    const entries = [];
    let currentEntry = null;
    let entryCounter = 0; // Counter to ensure unique IDs
    
    for (const line of lines) {
      // Check if line starts with timestamp (new note entry)
      const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC) by ([^\]]+)\] (.+)$/);
      
      if (timestampMatch) {
        // Save previous entry if exists
        if (currentEntry) {
          entries.push(currentEntry);
        }
        
        // Start new entry with unique ID
        entryCounter++;
        currentEntry = {
          id: `${timestampMatch[1]}_${timestampMatch[2]}_${entryCounter}`, // Add counter for uniqueness
          timestamp: timestampMatch[1],
          staff_member: timestampMatch[2],
          content: timestampMatch[3],
          fullLine: line // Keep original line for deletion
        };
      } else if (currentEntry && line.trim()) {
        // Continuation of current entry
        currentEntry.content += '\n' + line;
        currentEntry.fullLine += '\n' + line;
      }
    }
    
    // Add final entry
    if (currentEntry) {
      entries.push(currentEntry);
    }
    
    return entries.reverse(); // Show most recent first
  };

  /**
   * Fetch current notes
   */
  const fetchNotes = useCallback(async () => {
    if (!transaction?.transaction_id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const token = authService.getToken();
      
      if (!token) {
        const rawLegacy = transaction.internal_notes || '';
        // Filter out system-generated extension messages
        const filteredLegacy = rawLegacy
          .split('\n')
          .filter(line => {
            // Remove lines that look like system extension messages
            return !line.includes('Extension applied') && 
                   !line.includes('Extended') && 
                   !line.includes('Extension fee:') &&
                   !line.includes('New maturity:');
          })
          .join('\n');
        setRawNotes(filteredLegacy);
        setNoteEntries(parseNotesToEntries(filteredLegacy));
        setLoading(false);
        return;
      }
      
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${API_BASE_URL}/api/v1/notes/transaction/${transaction.transaction_id}/display`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Use ONLY manual_notes, not the combined legacy_notes which includes system entries
        const raw = data.manual_notes || '';
        setRawNotes(raw);
        setNoteEntries(parseNotesToEntries(raw));
      } else {
        // For legacy fallback, try to extract only manual notes if possible
        const rawLegacy = transaction.internal_notes || '';
        // Filter out system-generated extension messages
        const filteredLegacy = rawLegacy
          .split('\n')
          .filter(line => {
            // Remove lines that look like system extension messages
            return !line.includes('Extension applied') && 
                   !line.includes('Extended') && 
                   !line.includes('Extension fee:') &&
                   !line.includes('New maturity:');
          })
          .join('\n');
        setRawNotes(filteredLegacy);
        setNoteEntries(parseNotesToEntries(filteredLegacy));
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      const rawLegacy = transaction.internal_notes || '';
      // Filter out system-generated extension messages
      const filteredLegacy = rawLegacy
        .split('\n')
        .filter(line => {
          // Remove lines that look like system extension messages
          return !line.includes('Extension applied') && 
                 !line.includes('Extended') && 
                 !line.includes('Extension fee:') &&
                 !line.includes('New maturity:');
        })
        .join('\n');
      setRawNotes(filteredLegacy);
      setNoteEntries(parseNotesToEntries(filteredLegacy));
    } finally {
      setLoading(false);
    }
  }, [transaction?.transaction_id, transaction?.internal_notes]);

  /**
   * Add a new note
   */
  const handleAddNote = async () => {
    if (!newNote.trim() || !transaction?.transaction_id) return;

    try {
      setAddingNote(true);
      const token = authService.getToken();
      
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${API_BASE_URL}/api/v1/notes/transaction/${transaction.transaction_id}/manual-note`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            note: newNote.trim()
          })
        }
      );

      if (response.ok) {
        setNewNote('');
        await fetchNotes();
        toast.success('Note added successfully');
        
        if (onNotesUpdate) {
          onNotesUpdate();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.detail || 'Failed to add note');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  /**
   * Delete individual note
   */
  const handleDeleteNote = async (noteToDelete) => {
    if (!transaction?.transaction_id || !rawNotes) return;

    try {
      setDeletingNote(noteToDelete.id);
      
      // Remove the specific note from rawNotes
      const updatedNotes = rawNotes
        .split('\n')
        .filter(line => {
          // Remove lines that match this note's content
          return !noteToDelete.fullLine.split('\n').includes(line);
        })
        .join('\n')
        .trim();
      
      // Update the backend with the modified notes
      const token = authService.getToken();
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      
      // We'll use the existing manual-note endpoint to replace all notes
      // First clear, then add back the remaining notes
      if (updatedNotes) {
        // Clear existing notes
        await fetch(
          `${API_BASE_URL}/api/v1/notes/transaction/${transaction.transaction_id}/clear`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Add back remaining notes
        const remainingEntries = parseNotesToEntries(updatedNotes);
        for (const entry of remainingEntries.reverse()) { // Reverse to maintain original order
          await fetch(
            `${API_BASE_URL}/api/v1/notes/transaction/${transaction.transaction_id}/manual-note`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                note: entry.content
              })
            }
          );
        }
      } else {
        // Just clear all notes
        await fetch(
          `${API_BASE_URL}/api/v1/notes/transaction/${transaction.transaction_id}/clear`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      await fetchNotes();
      toast.success('Note deleted');
      
      if (onNotesUpdate) {
        onNotesUpdate();
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    } finally {
      setDeletingNote(null);
    }
  };

  // Load notes on mount and when transaction changes
  useEffect(() => {
    if (transaction?.transaction_id) {
      fetchNotes();
    }
  }, [fetchNotes, transaction]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <RotateCw className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">Loading notes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Individual Notes Display */}
      {noteEntries.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Notes
          </div>
          {noteEntries.map((entry) => (
            <Card key={entry.id} className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap flex-1">
                    {entry.content}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteNote(entry)}
                    disabled={deletingNote === entry.id}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                  >
                    {deletingNote === entry.id ? (
                      <RotateCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Note Section */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="p-3">
          <div className="space-y-3">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={noteEntries.length > 0 ? "Add another note..." : "Add a note..."}
              rows={2}
              className="resize-none text-sm"
              maxLength={5000}
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                {newNote.length}/5,000
              </div>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
              >
                {addingNote ? (
                  <>
                    <RotateCw className="w-3 h-3 mr-1 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}