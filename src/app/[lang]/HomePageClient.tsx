'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectMetadata } from '@/types/project';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface HomePageClientProps {
  params: Promise<{ lang: string }>;
  dict: any;
}

export default function HomePageClient({ params, dict }: HomePageClientProps) {
  const router = useRouter();
  const [locale, setLocale] = useState('en');
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectStyle, setNewProjectStyle] = useState('');
  const [creating, setCreating] = useState(false);

  // Get locale from params
  useEffect(() => {
    const getLocale = async () => {
      const resolvedParams = await params;
      setLocale(resolvedParams.lang);
    };
    getLocale();
  }, [params]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      } else {
        console.error('Failed to load projects:', data.error);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim() || !newProjectStyle.trim()) {
      alert(dict.homepage.createModal.validation);
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          style: newProjectStyle.trim()
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Navigate to the new project with locale
        router.push(`/${locale}/project/${data.project.id}`);
      } else {
        alert('Failed to create project: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const openProject = (projectId: string) => {
    router.push(`/${locale}/project/${projectId}`);
  };

  const deleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(dict.homepage.deleteConfirm.replace('{name}', projectName))) {
      return;
    }
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        loadProjects(); // Reload projects list
      } else {
        alert('Failed to delete project: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{dict.homepage.title}</h1>
              <p className="text-gray-600 mt-1">{dict.homepage.subtitle}</p>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher currentLocale={locale} dict={dict} />
              <button 
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                + {dict.homepage.newProject}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">{dict.common.loading}</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📁</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">{dict.homepage.noProjects.title}</h3>
            <p className="text-gray-600 mb-6">{dict.homepage.noProjects.subtitle}</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {dict.homepage.noProjects.button}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openProject(project.id)}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id, project.name);
                      }}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1"
                      title={dict.common.delete}
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium mr-2">{dict.homepage.projectCard.style}</span>
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">{project.style}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium mr-2">{dict.homepage.projectCard.sessions}</span>
                      <span>{project.sessionCount}</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <div>{dict.homepage.projectCard.created} {formatDate(project.createdAt)}</div>
                    <div>{dict.homepage.projectCard.updated} {formatDate(project.updatedAt)}</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-6 py-3 rounded-b-lg">
                  <span className="text-sm text-blue-600 font-medium">{dict.homepage.projectCard.openProject}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">{dict.homepage.createModal.title}</h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewProjectName('');
                    setNewProjectStyle('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                    {dict.homepage.createModal.projectName}
                  </label>
                  <input
                    id="projectName"
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={dict.homepage.createModal.projectNamePlaceholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="projectStyle" className="block text-sm font-medium text-gray-700 mb-2">
                    {dict.homepage.createModal.projectStyle}
                  </label>
                  <textarea
                    id="projectStyle"
                    value={newProjectStyle}
                    onChange={(e) => setNewProjectStyle(e.target.value)}
                    placeholder={dict.homepage.createModal.projectStylePlaceholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewProjectName('');
                    setNewProjectStyle('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  {dict.common.cancel}
                </button>
                <button
                  onClick={createProject}
                  disabled={creating || !newProjectName.trim() || !newProjectStyle.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md transition-colors"
                >
                  {creating ? dict.homepage.createModal.creating : dict.homepage.createModal.createProject}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 