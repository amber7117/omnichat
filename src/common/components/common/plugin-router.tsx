import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { useRouteTreeStore } from '../../../core/stores/route-tree.store';
import type { RouteNode } from '../../types/route';

function renderRoutes(nodes: RouteNode[]): React.ReactNode {
  return nodes
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(node => {
      const props: any = {
        element: node.element,
      };
      if (node.index) {
        props.index = true;
      } else {
        props.path = node.path;
      }

      return (
        <Route key={node.id} {...props}>
          {node.children && renderRoutes(node.children)}
        </Route>
      );
    });
}

export const PluginRouter: React.FC = () => {
  const routes = useRouteTreeStore(state => state.routes);
  return <Routes>
    {renderRoutes(routes)}
  </Routes>
};
