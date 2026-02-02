import React, { useCallback, useMemo } from 'react';
import { Layout, Model, TabNode, Actions } from 'flexlayout-react';
import type { IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';

import { VideoLayout } from './VideoLayout';
import CodeEditor from './CodeEditor';
import CodeTerminal from './CodeTerminal';
import CodeInput from './CodeInput';
import CustomChat from './CustomChat';
import { AssignmentView } from './AssignmentView';
import { QuizRunner } from './QuizRunner';
import { useMeetingStore } from '../store/useMeetingStore';

const getLayout = (hasQuiz: boolean): IJsonModel => ({
  global: {
    tabEnableClose: false,
    tabSetEnableTabStrip: true,
  },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        weight: 40,
        children: [
          { type: "tab", id: "video", name: "Cuộc họp", component: "video" }
        ]
      },
      {
        type: "row",
        weight: 60,
        children: [
          {
            type: "tabset",
            weight: 70,
            id: "editor_tabset",
            children: [
              { type: "tab", id: "code", name: "Trình code", component: "code" },
              { type: "tab", id: "assignment", name: "Đề bài", component: "assignment" },
              ...(hasQuiz ? [{ type: "tab", id: "quiz", name: "Trắc nghiệm 🔥", component: "quiz" }] : [])
            ]
          },
          {
            type: "tabset",
            weight: 30,
            id: "terminal_tabset",
            children: [
              { type: "tab", id: "terminal", name: "Output", component: "terminal" },
              { type: "tab", id: "input", name: "Input", component: "input" }
            ]
          }
        ]
      }
    ]
  }
});

export const MeetingWorkspace: React.FC<{
  onShowHistory: (socketId: string) => void;
}> = ({ onShowHistory }) => {
  const { activeQuiz, activeAdaptive } = useMeetingStore();

  const hasQuiz = !!activeQuiz || !!activeAdaptive;

  // Create model based on whether quiz exists
  const model = useMemo(() => {
    const layout = getLayout(hasQuiz);
    return Model.fromJson(layout);
  }, [activeQuiz?.id, activeAdaptive?.id]); // Use quiz/adaptive ID to trigger re-layout

  // Auto-select quiz tab when it appears
  React.useEffect(() => {
    if (hasQuiz) {
      const timer = setTimeout(() => {
        try {
          model.doAction(Actions.selectTab("quiz"));
        } catch (e) {}
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasQuiz, model]);

  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent();

    switch (component) {
      case "video":
        return <VideoLayout onShowHistory={onShowHistory} />;
      case "code":
        return <CodeEditor />;
      case "terminal":
        return <CodeTerminal />;
      case "input":
        return <CodeInput />;
      case "assignment":
        return <AssignmentView />;
      case "quiz":
        return <QuizRunner />;
      case "chat":
        return <CustomChat />;
      default:
        return <div>Component not found</div>;
    }
  }, [onShowHistory]);

  return (
    <div className="flex-1 relative h-full bg-[#1a1b1e]">
      <Layout model={model} factory={factory} />
      
      {/* Sidebar Overlay like VS Code borders if we want, but Layout already has borders */}
      <style>{`
        .flexlayout__layout {
          background-color: #1a1b1e;
        }
        .flexlayout__tabset_header {
           background-color: #1e1e1e !important;
        }
        .flexlayout__tab {
          background-color: #202124;
          overflow: hidden;
        }
        .flexlayout__tab_button {
          background-color: #2d2d2d;
          color: #969696;
          border-right: 1px solid #1a1b1e;
        }
        .flexlayout__tab_button--selected {
          background-color: #202124;
          color: #ffffff;
        }
        .flexlayout__splitter {
          background-color: #1a1b1e;
          transition: background-color 0.2s;
        }
        .flexlayout__splitter:hover {
          background-color: #007acc;
        }
      `}</style>
    </div>
  );
};
