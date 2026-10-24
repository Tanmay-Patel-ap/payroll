#pragma once

#include "repositories/IRoleRepository.hpp"
#include <string>
#include <mutex>

class JsonRoleRepository : public IRoleRepository {
public:
    explicit JsonRoleRepository(const std::string& filePath);

    std::vector<Role> getAll() override;
    std::optional<Role> getById(const std::string& id) override;
    std::optional<Role> getByName(const std::string& name) override;
    bool add(const Role& role) override;
    bool update(const Role& role) override;
    bool remove(const std::string& id) override;

private:
    std::string m_filePath;
    std::mutex m_mutex;

    void seedSampleDataIfEmpty();
    void loadFromFile(std::vector<Role>& list);
    void saveToFile(const std::vector<Role>& list);
};

